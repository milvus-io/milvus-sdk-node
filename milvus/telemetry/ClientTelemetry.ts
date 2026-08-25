import crypto from 'crypto';
import os from 'os';
import { AsyncLocalStorage } from 'async_hooks';
import { status as grpcStatus } from '@grpc/grpc-js';

const MAX_UNIMPLEMENTED_BACKOFF_MS = 30 * 60 * 1000;
// Node turns delays larger than a signed 32-bit integer into a 1ms timer. Split long
// heartbeat intervals into safe, cancellable chunks so a valid server-pushed interval
// cannot turn into a tight heartbeat loop.
const MAX_TIMER_DELAY_MS = 2_147_483_647;
const SAMPLE_BUFFER_SIZE = 1000;
// History needs enough distribution shape to aggregate percentiles across windows,
// but retaining the full live p99 ring for every snapshot would exceed 200 MiB at
// the one-hour/one-second hard cap. Keep 128 sorted, equidistant quantiles (including
// min/max): seven operations x 4096 windows is about 28 MiB of raw doubles.
const HISTORY_SAMPLE_BUFFER_SIZE = 128;
const HISTORY_RETENTION_MS = 60 * 60 * 1000;
// Preserve the 3601 boundary-inclusive windows produced by a full hour at a one-second
// heartbeat while still bounding memory if a server pushes a sub-second interval.
const MAX_HISTORY_SNAPSHOTS = 4096;
const MAX_REPLY_BYTES = 1024 * 1024;
// Fixed-point unit for accumulating a fractional sampling rate. A rate becomes an integer
// step of this many units, so the smallest rate that still samples is 1e-9 -- far below
// anything an operator would set, which is the point: a configured rate must never round
// down to "off".
const SAMPLING_SCALE = 1_000_000_000;
const PUSH_CONFIG_KEYS = new Set([
  'enabled',
  'heartbeat_interval_ms',
  'sampling_rate',
]);

export interface TelemetryConfig {
  enabled?: boolean;
  heartbeatIntervalMs?: number;
  samplingRate?: number;
  errorMaxCount?: number;
  /** Pins telemetry identity across process restarts. */
  clientId?: string;
}

export interface TelemetryMetric {
  request_count: number;
  success_count: number;
  error_count: number;
  avg_latency_ms: number;
  p99_latency_ms: number;
  max_latency_ms: number;
}

export interface TelemetryOperationMetrics {
  operation: string;
  global: TelemetryMetric;
  collection_metrics: Record<string, TelemetryMetric>;
}

export interface TelemetrySnapshot {
  timestamp: number;
  end_time: number;
  metrics: TelemetryOperationMetrics[];
}

export interface TelemetryError {
  timestamp: number;
  operation: string;
  error_msg: string;
  collection?: string;
  request_id?: string;
}

export interface ClientCommand {
  command_id: string;
  command_type: string;
  payload?: Uint8Array | Buffer | string;
  create_time?: number | string;
  persistent?: boolean;
  target_scope?: string;
}

export interface CommandReply {
  command_id: string;
  success: boolean;
  error_message?: string;
  payload?: Buffer;
}

export type CommandHandler = (
  command: ClientCommand
) => CommandReply | Promise<CommandReply>;

export interface OperationRecord {
  operation: string;
  collection: string;
  startTime: number;
  error?: unknown;
  requestId?: string;
}

type HeartbeatSender = (request: Record<string, unknown>) => Promise<any>;

class MetricBucket {
  requests = 0;
  successes = 0;
  failures = 0;
  totalLatencyMs = 0;
  maxLatencyMs = 0;
  samples: number[] = [];

  record(latencyMs: number, success: boolean) {
    this.requests += 1;
    this.successes += success ? 1 : 0;
    this.failures += success ? 0 : 1;
    this.totalLatencyMs += latencyMs;
    this.maxLatencyMs = Math.max(this.maxLatencyMs, latencyMs);
    this.samples.push(latencyMs);
    if (this.samples.length > SAMPLE_BUFFER_SIZE) {
      this.samples.shift();
    }
  }

  snapshot(): TelemetryMetric | undefined {
    if (this.requests === 0) {
      return undefined;
    }
    const sorted = [...this.samples].sort((left, right) => left - right);
    const p99 = sorted.length
      ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.99))]
      : 0;
    return {
      request_count: this.requests,
      success_count: this.successes,
      error_count: this.failures,
      avg_latency_ms: this.totalLatencyMs / this.requests,
      p99_latency_ms: p99,
      max_latency_ms: this.maxLatencyMs,
    };
  }
}

class OperationCollector {
  global = new MetricBucket();
  collections = new Map<string, MetricBucket>();

  record(collection: string, latencyMs: number, success: boolean) {
    this.global.record(latencyMs, success);
    if (collection) {
      let bucket = this.collections.get(collection);
      if (!bucket) {
        bucket = new MetricBucket();
        this.collections.set(collection, bucket);
      }
      bucket.record(latencyMs, success);
    }
  }

  snapshot(operation: string):
    | {
        metric: TelemetryOperationMetrics;
        globalLatencySamples: Float64Array;
      }
    | undefined {
    const global = this.global.snapshot();
    if (!global) {
      return undefined;
    }
    const globalLatencySamples = retainQuantileSamples(this.global.samples);
    const collectionMetrics: Record<string, TelemetryMetric> = {};
    for (const [name, bucket] of this.collections) {
      const metric = bucket.snapshot();
      if (metric) {
        collectionMetrics[name] = metric;
      }
    }
    this.global = new MetricBucket();
    this.collections.clear();
    return {
      metric: {
        operation,
        global,
        collection_metrics: collectionMetrics,
      },
      globalLatencySamples,
    };
  }
}

export class ClientTelemetryManager {
  public readonly clientId: string;
  public readonly stableClientId: boolean;
  public ready = false;
  public configHash = '';
  public lastCommandTimestamp = 0;
  public lastHeartbeatError: unknown;

  private readonly sender: HeartbeatSender;
  private sdkVersion: string;
  private readonly userProvider: () => string;
  private readonly databaseProvider: () => string;
  private readonly configProvider: () => Record<string, unknown>;
  private readonly senderEpochProvider: () => number;
  private readonly collectors = new Map<string, OperationCollector>();
  private readonly errors: TelemetryError[] = [];
  private readonly snapshots: TelemetrySnapshot[] = [];
  // Kept outside TelemetrySnapshot so samples never enter heartbeat/detail/public JSON.
  // Pruning explicitly deletes matching entries to enforce the hard memory bound.
  private readonly snapshotLatencySamples = new Map<
    TelemetrySnapshot,
    Record<string, Float64Array>
  >();
  private readonly pendingReplies: CommandReply[] = [];
  private readonly executedCommands = new Map<string, number>();
  private readonly handlers = new Map<string, CommandHandler>();
  private readonly enabledCollections = new Set<string>();
  private allCollectionsEnabled = false;
  private enabled: boolean;
  private heartbeatIntervalMs: number;
  private samplingRate: number;
  private readonly errorMaxCount: number;
  // Carries the fractional sampling rate between calls, in SAMPLING_SCALE units: each
  // operation adds the rate and the one that pushes it past a whole unit is the one
  // sampled. See shouldSample.
  private samplingAccum = 0;
  private unsupportedStreak = 0;
  private timer?: NodeJS.Timeout;
  private stopped = false;
  private lastSnapshotEnd = 0;
  // Command handlers may be asynchronous and ProcessCommands is public. Keep whole batches
  // on one queue so two concurrent heartbeats/callers cannot both execute the same ID after
  // observing it as absent.
  private commandQueue: Promise<void> = Promise.resolve();
  // Awaiting processCommands() from a handler would enqueue work behind the batch that is
  // currently awaiting that handler. Track the active handler context so recursive use can
  // fail as a correlated command reply instead of creating a promise cycle. The mutable
  // flag lets work scheduled for after a completed handler use the public queue normally.
  private readonly commandHandlerScope = new AsyncLocalStorage<{
    active: boolean;
  }>();

  constructor(options: {
    sender: HeartbeatSender;
    config?: TelemetryConfig;
    sdkVersion?: string;
    userProvider?: () => string;
    databaseProvider?: () => string;
    configProvider?: () => Record<string, unknown>;
    senderEpochProvider?: () => number;
  }) {
    const config = options.config || {};
    this.sender = options.sender;
    this.sdkVersion = options.sdkVersion || '';
    this.userProvider = options.userProvider || (() => '');
    this.databaseProvider = options.databaseProvider || (() => '');
    this.configProvider = options.configProvider || (() => ({}));
    this.senderEpochProvider = options.senderEpochProvider || (() => 0);
    if (config.enabled !== undefined && typeof config.enabled !== 'boolean') {
      throw new Error('enabled must be a boolean');
    }
    this.enabled = config.enabled ?? true;
    // Milliseconds between heartbeats, and therefore the metrics window: each heartbeat
    // carries the operations since the last one. The coordinator answers a telemetry query
    // from the window before the newest, so what a caller reads is between one and two
    // intervals old.
    this.heartbeatIntervalMs = Number(config.heartbeatIntervalMs ?? 10_000);
    if (
      !Number.isFinite(this.heartbeatIntervalMs) ||
      this.heartbeatIntervalMs <= 0
    ) {
      throw new Error('heartbeatIntervalMs must be a finite positive number');
    }
    const samplingRate = config.samplingRate ?? 1;
    if (typeof samplingRate !== 'number' || !Number.isFinite(samplingRate)) {
      throw new Error('samplingRate must be a finite number');
    }
    this.samplingRate = clamp(samplingRate, 0, 1);
    const errorMaxCount = config.errorMaxCount ?? 100;
    if (
      typeof errorMaxCount !== 'number' ||
      !Number.isSafeInteger(errorMaxCount) ||
      errorMaxCount <= 0
    ) {
      throw new Error('errorMaxCount must be a positive integer');
    }
    this.errorMaxCount = errorMaxCount;
    this.stableClientId = Boolean(config.clientId);
    this.clientId = config.clientId || crypto.randomUUID();
    this.registerDefaultHandlers();
  }

  start() {
    if (this.ready) {
      return;
    }
    this.ready = true;
    if (!this.enabled) {
      return;
    }
    void this.heartbeatLoop();
  }

  setSdkVersion(version: string) {
    this.sdkVersion = version;
  }

  stop() {
    this.stopped = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }

  isSupported() {
    return this.unsupportedStreak === 0;
  }

  getConfig(): Required<TelemetryConfig> {
    return {
      enabled: this.enabled,
      heartbeatIntervalMs: this.heartbeatIntervalMs,
      samplingRate: this.samplingRate,
      errorMaxCount: this.errorMaxCount,
      clientId: this.clientId,
    };
  }

  registerCommandHandler(type: string, handler: CommandHandler) {
    this.handlers.set(type, handler);
  }

  recordOperation(record: OperationRecord) {
    if (!this.enabled || !this.shouldSample()) {
      return;
    }
    const latencyMs = Math.max(0, performance.now() - record.startTime);
    const collection =
      record.collection &&
      (this.allCollectionsEnabled ||
        this.enabledCollections.has(record.collection))
        ? record.collection
        : '';
    let collector = this.collectors.get(record.operation);
    if (!collector) {
      collector = new OperationCollector();
      this.collectors.set(record.operation, collector);
    }
    collector.record(collection, latencyMs, !record.error);
    if (record.error) {
      this.errors.push({
        timestamp: Date.now(),
        operation: record.operation,
        error_msg: errorMessage(record.error),
        collection: record.collection || undefined,
        request_id: record.requestId || undefined,
      });
      while (this.errors.length > this.errorMaxCount) {
        this.errors.shift();
      }
    }
  }

  getRecentErrors(maxCount = 100): TelemetryError[] {
    return [...this.errors].reverse().slice(0, maxCount);
  }

  getMetricsSnapshots(): TelemetrySnapshot[] {
    this.pruneSnapshots(Date.now());
    return [...this.snapshots];
  }

  processCommands(commands: ClientCommand[]): Promise<void> {
    if (this.commandHandlerScope.getStore()?.active) {
      const rejected = Promise.reject(
        new Error(
          'processCommands cannot be called recursively from a command handler'
        )
      );
      // Preserve the rejection for callers that await it, but attach a handler immediately
      // so fire-and-forget recursion cannot surface as an unhandled rejection.
      void rejected.catch(() => undefined);
      return rejected;
    }
    return this.enqueueCommandBatch(commands);
  }

  private enqueueCommandBatch(
    commands: ClientCommand[],
    expectedSenderEpoch?: number
  ): Promise<void> {
    const queued = this.commandQueue.then(() =>
      this.processCommandBatch(commands, expectedSenderEpoch)
    );
    // A custom handler is isolated by handleCommand, but keep the queue usable even if a
    // future batch-level change throws unexpectedly.
    this.commandQueue = queued.catch(() => undefined);
    return queued;
  }

  private async processCommandBatch(
    commands: ClientCommand[],
    expectedSenderEpoch?: number
  ) {
    if (
      expectedSenderEpoch !== undefined &&
      expectedSenderEpoch !== this.senderEpochProvider()
    ) {
      return;
    }
    const previousTimestamp = this.lastCommandTimestamp;
    let maxTimestamp = previousTimestamp;
    let hasPersistent = false;
    for (const command of commands) {
      const createTime = Number(command.create_time || 0);
      maxTimestamp = Math.max(maxTimestamp, createTime);
      hasPersistent ||= Boolean(command.persistent);
      if (createTime < previousTimestamp) {
        this.pendingReplies.push(successReply(command.command_id));
        continue;
      }
      if (this.executedCommands.has(command.command_id)) {
        this.pendingReplies.push(successReply(command.command_id));
        continue;
      }
      const reply = await this.handleCommand(command);
      this.executedCommands.set(command.command_id, createTime);
      this.pendingReplies.push(reply);
      if (
        expectedSenderEpoch !== undefined &&
        expectedSenderEpoch !== this.senderEpochProvider()
      ) {
        // The completed handler may itself have changed the live endpoint. Retain its ID
        // and correlated reply so redelivery cannot repeat a non-idempotent prefix, but do
        // not apply the retired endpoint's remaining commands or commit its cursor/hash.
        return;
      }
    }
    // Keep IDs at the new cursor timestamp: timestamp filtering only rejects commands
    // strictly older than the cursor, so equal-timestamp redeliveries still need ID-based
    // deduplication. Entries below the new cursor can be discarded safely.
    for (const [id, timestamp] of this.executedCommands) {
      if (timestamp < maxTimestamp) {
        this.executedCommands.delete(id);
      }
    }
    if (hasPersistent) {
      this.configHash = ClientTelemetryManager.calculateConfigHash(commands);
    }
    this.lastCommandTimestamp = Math.max(
      this.lastCommandTimestamp,
      maxTimestamp
    );
  }

  static calculateConfigHash(commands: ClientCommand[]): string {
    const persistent = commands
      .filter(command => command.persistent)
      .sort((left, right) => compareUtf8(left.command_id, right.command_id));
    if (!persistent.length) {
      return '';
    }
    const hash = crypto.createHash('sha256');
    for (const command of persistent) {
      hash.update(command.command_id);
      hash.update(command.command_type);
      hash.update(payloadBuffer(command.payload));
    }
    return hash.digest('hex').slice(0, 16);
  }

  private async heartbeatLoop() {
    try {
      this.createSnapshot();
      await this.sendHeartbeat();
    } catch (error) {
      // Telemetry is an optional background control plane. An unexpected collector,
      // serializer, command, or transport failure must not terminate the loop forever.
      this.lastHeartbeatError = error;
    } finally {
      if (this.stopped) {
        return;
      }
      this.scheduleNextHeartbeat(this.nextHeartbeatDelay());
    }
  }

  private scheduleNextHeartbeat(remainingDelayMs: number) {
    const chunk = Math.min(remainingDelayMs, MAX_TIMER_DELAY_MS);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      if (this.stopped) {
        return;
      }
      const remaining = Math.max(0, remainingDelayMs - chunk);
      if (remaining > 0) {
        this.scheduleNextHeartbeat(remaining);
        return;
      }
      void this.heartbeatLoop();
    }, chunk);
    // Telemetry is best-effort background work and must not keep an otherwise idle Node
    // process alive.
    this.timer.unref?.();
  }

  private nextHeartbeatDelay() {
    if (this.unsupportedStreak <= 0) {
      return this.heartbeatIntervalMs;
    }
    return Math.max(
      this.heartbeatIntervalMs,
      Math.min(
        MAX_UNIMPLEMENTED_BACKOFF_MS,
        this.heartbeatIntervalMs * 2 ** this.unsupportedStreak
      )
    );
  }

  private async sendHeartbeat() {
    const latest = this.snapshots[this.snapshots.length - 1];
    const replies = [...this.pendingReplies];
    const reserved: Record<string, string> = {
      client_id: this.clientId,
      client_id_stable: String(this.stableClientId),
    };
    const database = this.databaseProvider();
    if (database) {
      reserved.db_name = database;
    }
    let response: any;
    const senderEpoch = this.senderEpochProvider();
    try {
      response = await this.sender({
        client_info: {
          sdk_type: 'nodejs',
          sdk_version: this.sdkVersion,
          local_time: new Date().toISOString(),
          user: this.userProvider(),
          host: os.hostname(),
          reserved,
        },
        report_timestamp: Date.now(),
        // Do not resend the last enabled snapshot while collection is disabled. Replies,
        // config hash, cursor and commands remain active as the control plane.
        metrics: this.enabled
          ? this.filterMetricsForWire(latest?.metrics || [])
          : [],
        command_replies: replies,
        config_hash: this.configHash,
        last_command_timestamp: this.lastCommandTimestamp,
      });
    } catch (error: any) {
      if (senderEpoch !== this.senderEpochProvider()) {
        return;
      }
      this.lastHeartbeatError = error;
      if (error?.code === grpcStatus.UNIMPLEMENTED) {
        this.unsupportedStreak += 1;
      }
      return;
    }

    // A global-cluster failover can publish a new telemetry transport while this
    // heartbeat is awaiting the old endpoint. Treat that old response as if it never
    // arrived: do not acknowledge replies, reset backoff/errors, execute commands, or
    // mutate any command/config history.
    if (senderEpoch !== this.senderEpochProvider()) {
      return;
    }

    // Any real response proves the RPC exists. Reset an old UNIMPLEMENTED streak before
    // checking the business status, which may fail while the service is still starting.
    this.unsupportedStreak = 0;
    if (!responseSucceeded(response)) {
      this.lastHeartbeatError = new Error(
        response?.status?.reason || 'client heartbeat failed'
      );
      return;
    }
    this.pendingReplies.splice(0, replies.length);
    this.lastHeartbeatError = undefined;
    await this.enqueueCommandBatch(response?.commands || [], senderEpoch);
  }

  /**
   * Decide whether this operation is recorded, spreading the sampled ones evenly rather
   * than in runs.
   *
   * Each call adds the rate to an accumulator and samples on the call that carries it
   * across a whole unit: at 0.25 that is every fourth operation. The ratio has to hold
   * over any stretch of calls, not only over a long one -- metrics are reported per
   * heartbeat window, and a window is tens or hundreds of operations, so sampling a
   * contiguous run would make each window either complete or empty.
   */
  private shouldSample() {
    if (this.samplingRate >= 1) {
      return true;
    }
    if (this.samplingRate <= 0) {
      return false;
    }
    // A rate too small to represent still means "sample rarely", never "sample never":
    // silently disabling telemetry for a positive rate is the one outcome nobody could
    // have intended.
    const step = Math.max(1, Math.floor(this.samplingRate * SAMPLING_SCALE));
    this.samplingAccum += step;
    if (this.samplingAccum < SAMPLING_SCALE) {
      return false;
    }
    // Keep only the remainder rather than letting the accumulator grow without bound: a
    // JavaScript number is exact only to 2^53, which at a few hundred million units per
    // operation is reached within a day of steady traffic, after which the comparison
    // would start losing operations silently.
    this.samplingAccum -= SAMPLING_SCALE;
    return true;
  }

  private createSnapshot() {
    if (!this.enabled) {
      return;
    }
    const metrics: TelemetryOperationMetrics[] = [];
    const latencySamples: Record<string, Float64Array> = {};
    for (const [operation, collector] of this.collectors) {
      const collected = collector.snapshot(operation);
      if (collected) {
        metrics.push(collected.metric);
        latencySamples[operation] = collected.globalLatencySamples;
      }
    }
    const now = Date.now();
    const start =
      !this.lastSnapshotEnd || this.lastSnapshotEnd > now
        ? now - this.heartbeatIntervalMs
        : this.lastSnapshotEnd;
    this.lastSnapshotEnd = now;
    const snapshot = { timestamp: start, end_time: now, metrics };
    this.snapshots.push(snapshot);
    this.snapshotLatencySamples.set(snapshot, latencySamples);
    this.pruneSnapshots(now);
  }

  private pruneSnapshots(now: number) {
    const cutoff = now - HISTORY_RETENTION_MS;
    while (this.snapshots.length && this.snapshots[0].end_time < cutoff) {
      const expired = this.snapshots.shift();
      if (expired) {
        this.snapshotLatencySamples.delete(expired);
      }
    }
    while (this.snapshots.length > MAX_HISTORY_SNAPSHOTS) {
      const expired = this.snapshots.shift();
      if (expired) {
        this.snapshotLatencySamples.delete(expired);
      }
    }
  }

  private filterMetricsForWire(
    metrics: TelemetryOperationMetrics[]
  ): TelemetryOperationMetrics[] {
    return metrics.map(operation => {
      const collectionMetrics: Record<string, TelemetryMetric> = {};
      for (const [collection, metric] of Object.entries(
        operation.collection_metrics
      )) {
        if (
          this.allCollectionsEnabled ||
          this.enabledCollections.has(collection)
        ) {
          collectionMetrics[collection] = metric;
        }
      }
      return { ...operation, collection_metrics: collectionMetrics };
    });
  }

  private async handleCommand(command: ClientCommand): Promise<CommandReply> {
    const handler = this.handlers.get(command.command_type);
    if (!handler) {
      return failedReply(
        command.command_id,
        `unknown command type: ${command.command_type}`
      );
    }
    const handlerScope = { active: true };
    try {
      const reply = await this.commandHandlerScope.run(handlerScope, () =>
        handler(command)
      );
      if (!reply || typeof reply !== 'object') {
        return failedReply(
          command.command_id,
          'command handler returned no reply'
        );
      }
      // command_id is the server's correlation key. A custom handler may customize the
      // result, but it may never acknowledge a different command.
      return { ...reply, command_id: command.command_id };
    } catch (error) {
      return failedReply(command.command_id, errorMessage(error));
    } finally {
      handlerScope.active = false;
    }
  }

  private registerDefaultHandlers() {
    this.registerCommandHandler('push_config', command => {
      const payload = parsePayload(command);
      const enabled = optionalBoolean(payload, 'enabled');
      const heartbeatIntervalMs = optionalInteger(
        payload,
        'heartbeat_interval_ms'
      );
      const samplingRate = optionalFiniteNumber(payload, 'sampling_rate');
      // Validate the complete payload before changing any field. A failed command must not
      // leave an earlier key applied while reporting that the whole command failed.
      if (heartbeatIntervalMs !== undefined && heartbeatIntervalMs <= 0) {
        throw new Error('heartbeat_interval_ms must be a positive integer');
      }

      const applied: string[] = [];
      if (enabled !== undefined) {
        applied.push('enabled');
      }
      if (heartbeatIntervalMs !== undefined) {
        applied.push('heartbeat_interval_ms');
      }
      if (samplingRate !== undefined) {
        applied.push('sampling_rate');
      }
      const ignored = Object.keys(payload)
        .filter(key => !PUSH_CONFIG_KEYS.has(key))
        .sort(compareUtf8);

      if (enabled !== undefined) {
        this.enabled = enabled;
      }
      if (heartbeatIntervalMs !== undefined) {
        this.heartbeatIntervalMs = heartbeatIntervalMs;
      }
      if (samplingRate !== undefined) {
        this.samplingRate = clamp(samplingRate, 0, 1);
      }

      return successReply(
        command.command_id,
        Buffer.from(
          JSON.stringify({
            applied,
            ...(ignored.length ? { ignored } : {}),
          })
        )
      );
    });

    this.registerCommandHandler('collection_metrics', command => {
      if (!payloadBuffer(command.payload).length) {
        return successReply(
          command.command_id,
          Buffer.from(
            JSON.stringify({
              enabled_collections: [...this.enabledCollections].sort(),
              all_collections_enabled: this.allCollectionsEnabled,
            })
          )
        );
      }
      const payload = parsePayload(command);
      const enabled = optionalBoolean(payload, 'enabled') ?? false;
      const collections = optionalStringArray(payload, 'collections') ?? [];
      // metrics_types is not acted on yet, but it is part of the protocol payload and must
      // still have the same typed-JSON behavior as the Go SDK.
      optionalStringArray(payload, 'metrics_types');
      const wildcard = collections.includes('*');
      if (enabled) {
        if (!collections.length) {
          throw new Error('collections list cannot be empty when enabled=true');
        }
        if (wildcard) {
          this.allCollectionsEnabled = true;
        } else {
          collections.forEach(name => this.enabledCollections.add(name));
        }
      } else if (wildcard || !collections.length) {
        this.allCollectionsEnabled = false;
        this.enabledCollections.clear();
      } else {
        collections.forEach(name => this.enabledCollections.delete(name));
      }
      return successReply(command.command_id);
    });

    this.registerCommandHandler('show_errors', command => {
      const payload = parsePayload(command);
      const configuredMaxCount = optionalInteger(payload, 'max_count');
      const maxCount =
        configuredMaxCount !== undefined && configuredMaxCount > 0
          ? configuredMaxCount
          : 100;
      let errors = this.getRecentErrors(maxCount).map(error => ({ ...error }));
      if (!errors.length) {
        return successReply(command.command_id);
      }
      let encoded = Buffer.from(JSON.stringify(errors));
      while (encoded.length > MAX_REPLY_BYTES && errors.length > 1) {
        errors = errors.slice(0, Math.max(1, Math.floor(errors.length / 2)));
        encoded = Buffer.from(JSON.stringify(errors));
      }
      if (encoded.length > MAX_REPLY_BYTES && errors.length === 1) {
        encoded = truncateSingleErrorReply(errors[0], MAX_REPLY_BYTES);
      }
      if (encoded.length > MAX_REPLY_BYTES) {
        throw new Error('show_errors response exceeds the 1MB payload limit');
      }
      return successReply(command.command_id, encoded);
    });

    this.registerCommandHandler('get_config', command => {
      const userConfig = { ...this.configProvider() };
      ['password', 'token', 'api_key', 'authorization'].forEach(
        key => delete userConfig[key]
      );
      Object.assign(userConfig, {
        telemetry_enabled: this.enabled,
        telemetry_heartbeat_interval_ms: this.heartbeatIntervalMs,
        telemetry_sampling_rate: this.samplingRate,
        enabled_collections: this.allCollectionsEnabled
          ? ['*']
          : [...this.enabledCollections].sort(),
        all_collections_enabled: this.allCollectionsEnabled,
      });
      return successReply(
        command.command_id,
        Buffer.from(JSON.stringify({ user_config: userConfig }))
      );
    });

    this.registerCommandHandler('show_latency_history', command => {
      const payload = parsePayload(command);
      if (
        typeof payload.start_time !== 'string' ||
        typeof payload.end_time !== 'string'
      ) {
        throw new Error('payload is required with start_time and end_time');
      }
      if ('detail' in payload && typeof payload.detail !== 'boolean') {
        throw new Error('detail must be a boolean');
      }
      const start = parseRfc3339(payload.start_time, 'start_time');
      const end = parseRfc3339(payload.end_time, 'end_time');
      if (end < start) {
        throw new Error('end_time must be after start_time');
      }
      if (end - start > 60 * 60 * 1000) {
        throw new Error('time range cannot exceed 1 hour');
      }
      this.pruneSnapshots(Date.now());
      const snapshots = this.snapshots.filter(
        snapshot => snapshot.end_time >= start && snapshot.timestamp <= end
      );
      const body =
        payload.detail === true
          ? {
              snapshots: detailSnapshots(snapshots),
              total_snapshots: snapshots.length,
            }
          : aggregateSnapshots(
              snapshots,
              start,
              end,
              snapshot => this.snapshotLatencySamples.get(snapshot) || {}
            );
      const encoded = Buffer.from(JSON.stringify(body));
      if (encoded.length > MAX_REPLY_BYTES) {
        throw new Error('response too large, try a smaller time range');
      }
      return successReply(command.command_id, encoded);
    });
  }
}

export function newClientRequestId(): string {
  let value: Buffer;
  do {
    value = crypto.randomBytes(16);
  } while (value.every(byte => byte === 0));
  return value.toString('hex');
}

function payloadBuffer(payload?: Uint8Array | Buffer | string): Buffer {
  if (!payload) {
    return Buffer.alloc(0);
  }
  return typeof payload === 'string'
    ? Buffer.from(payload)
    : Buffer.from(payload);
}

function parsePayload(command: ClientCommand): Record<string, any> {
  const payload = payloadBuffer(command.payload);
  if (!payload.length) {
    return {};
  }
  const parsed = JSON.parse(payload.toString());
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('command payload must be a JSON object');
  }
  return parsed;
}

function truncateSingleErrorReply(
  error: TelemetryError,
  maxBytes: number
): Buffer {
  const mutableError = error as unknown as Record<string, unknown>;
  const fields = ['error_msg', 'collection', 'request_id', 'operation'].sort(
    (left, right) =>
      Buffer.byteLength(String(mutableError[right] || '')) -
      Buffer.byteLength(String(mutableError[left] || ''))
  );
  const suffix = '...(truncated)';
  let encoded = Buffer.from(JSON.stringify([error]));

  for (const field of fields) {
    if (encoded.length <= maxBytes) {
      return encoded;
    }
    const original = mutableError[field];
    if (typeof original !== 'string' || original.length === 0) {
      continue;
    }

    // Halve an original prefix, never the already suffixed value. The prefix length strictly
    // decreases to zero, so this terminates even when another field caused the overflow.
    let prefixLength = original.length;
    while (encoded.length > maxBytes && prefixLength > 0) {
      prefixLength = Math.floor(prefixLength / 2);
      const prefix = unicodeSafePrefix(original, prefixLength);
      mutableError[field] = prefix ? `${prefix}${suffix}` : '';
      encoded = Buffer.from(JSON.stringify([error]));
    }
    if (encoded.length <= maxBytes) {
      return encoded;
    }

    if (field === 'collection' || field === 'request_id') {
      delete mutableError[field];
    }
    encoded = Buffer.from(JSON.stringify([error]));
  }
  return encoded;
}

function unicodeSafePrefix(value: string, length: number): string {
  let end = Math.min(value.length, Math.max(0, length));
  if (
    end > 0 &&
    end < value.length &&
    value.charCodeAt(end - 1) >= 0xd800 &&
    value.charCodeAt(end - 1) <= 0xdbff &&
    value.charCodeAt(end) >= 0xdc00 &&
    value.charCodeAt(end) <= 0xdfff
  ) {
    end -= 1;
  }
  return value.slice(0, end);
}

function optionalBoolean(
  payload: Record<string, any>,
  key: string
): boolean | undefined {
  if (!(key in payload)) {
    return undefined;
  }
  if (typeof payload[key] !== 'boolean') {
    throw new Error(`${key} must be a boolean`);
  }
  return payload[key];
}

function optionalFiniteNumber(
  payload: Record<string, any>,
  key: string
): number | undefined {
  if (!(key in payload)) {
    return undefined;
  }
  const value = payload[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${key} must be a finite number`);
  }
  return value;
}

function optionalInteger(
  payload: Record<string, any>,
  key: string
): number | undefined {
  const value = optionalFiniteNumber(payload, key);
  if (value !== undefined && !Number.isSafeInteger(value)) {
    throw new Error(`${key} must be an integer`);
  }
  return value;
}

function optionalStringArray(
  payload: Record<string, any>,
  key: string
): string[] | undefined {
  if (!(key in payload)) {
    return undefined;
  }
  const value = payload[key];
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) {
    throw new Error(`${key} must be an array of strings`);
  }
  return value;
}

function compareUtf8(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left), Buffer.from(right));
}

const RFC3339_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(?:Z|([+-])(\d{2}):(\d{2}))$/;

function parseRfc3339(value: string, field: string): number {
  const match = RFC3339_PATTERN.exec(value);
  if (!match) {
    throw new Error(`invalid ${field} format, expected RFC3339`);
  }
  const [, year, month, day, hour, minute, second, , , zoneHour, zoneMinute] =
    match;
  const numericYear = Number(year);
  const numericMonth = Number(month);
  const numericDay = Number(day);
  const numericHour = Number(hour);
  const numericMinute = Number(minute);
  const numericSecond = Number(second);
  const numericZoneHour = zoneHour === undefined ? 0 : Number(zoneHour);
  const numericZoneMinute = zoneMinute === undefined ? 0 : Number(zoneMinute);
  const leapYear =
    numericYear % 4 === 0 &&
    (numericYear % 100 !== 0 || numericYear % 400 === 0);
  const daysInMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ][numericMonth - 1];
  if (
    numericMonth < 1 ||
    numericMonth > 12 ||
    numericDay < 1 ||
    numericDay > (daysInMonth || 0) ||
    numericHour > 23 ||
    numericMinute > 59 ||
    numericSecond > 59 ||
    numericZoneHour > 23 ||
    numericZoneMinute > 59
  ) {
    throw new Error(`invalid ${field} format, expected RFC3339`);
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`invalid ${field} format, expected RFC3339`);
  }
  return parsed;
}

function successReply(commandId: string, payload = Buffer.alloc(0)) {
  return { command_id: commandId, success: true, payload };
}

function failedReply(commandId: string, error: string) {
  return { command_id: commandId, success: false, error_message: error };
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function responseSucceeded(response: any) {
  const status = response?.status;
  if (!status) {
    return true;
  }
  const code = Number(status.code || 0);
  const errorCode = status.error_code;
  return (
    code === 0 &&
    (errorCode === undefined ||
      errorCode === 0 ||
      errorCode === '0' ||
      errorCode === 'Success' ||
      errorCode === 'SUCCESS')
  );
}

function retainQuantileSamples(samples: number[]) {
  const sorted = [...samples].sort((left, right) => left - right);
  if (sorted.length <= HISTORY_SAMPLE_BUFFER_SIZE) {
    return Float64Array.from(sorted);
  }
  return Float64Array.from(
    { length: HISTORY_SAMPLE_BUFFER_SIZE },
    (_, index) => {
      const sourceIndex = Math.round(
        (index * (sorted.length - 1)) / (HISTORY_SAMPLE_BUFFER_SIZE - 1)
      );
      return sorted[sourceIndex];
    }
  );
}

function weightedPercentile(
  groups: Array<{ samples: Float64Array; weight: number }>,
  target: number
) {
  type Cursor = {
    samples: Float64Array;
    weight: number;
    index: number;
    latency: number;
  };
  const heap: Cursor[] = [];
  const push = (cursor: Cursor) => {
    heap.push(cursor);
    let index = heap.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (heap[parent].latency <= cursor.latency) {
        break;
      }
      heap[index] = heap[parent];
      index = parent;
    }
    heap[index] = cursor;
  };
  const pop = () => {
    const first = heap[0];
    const last = heap.pop();
    if (heap.length && last) {
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        if (left >= heap.length) {
          break;
        }
        const right = left + 1;
        const child =
          right < heap.length && heap[right].latency < heap[left].latency
            ? right
            : left;
        if (heap[child].latency >= last.latency) {
          break;
        }
        heap[index] = heap[child];
        index = child;
      }
      heap[index] = last;
    }
    return first;
  };

  for (const group of groups) {
    if (group.samples.length) {
      push({ ...group, index: 0, latency: group.samples[0] });
    }
  }
  let cumulative = 0;
  let percentile = 0;
  while (heap.length) {
    const cursor = pop();
    cumulative += cursor.weight;
    percentile = cursor.latency;
    if (cumulative > target) {
      return percentile;
    }
    cursor.index += 1;
    if (cursor.index < cursor.samples.length) {
      cursor.latency = cursor.samples[cursor.index];
      push(cursor);
    }
  }
  return percentile;
}

function aggregateSnapshots(
  snapshots: TelemetrySnapshot[],
  start: number,
  end: number,
  latencySamplesFor: (
    snapshot: TelemetrySnapshot
  ) => Record<string, Float64Array>
) {
  const totals: Record<
    string,
    {
      request_count: number;
      success_count: number;
      error_count: number;
      weighted_avg: number;
      max_latency_ms: number;
      latency_sample_groups: Array<{
        samples: Float64Array;
        weight: number;
      }>;
    }
  > = {};
  for (const snapshot of snapshots) {
    const latencySamples = latencySamplesFor(snapshot);
    for (const operation of snapshot.metrics) {
      const metric = operation.global;
      const total = (totals[operation.operation] ||= {
        request_count: 0,
        success_count: 0,
        error_count: 0,
        weighted_avg: 0,
        max_latency_ms: 0,
        latency_sample_groups: [],
      });
      total.request_count += metric.request_count;
      total.success_count += metric.success_count;
      total.error_count += metric.error_count;
      total.weighted_avg += metric.avg_latency_ms * metric.request_count;
      total.max_latency_ms = Math.max(
        total.max_latency_ms,
        metric.max_latency_ms
      );
      const samples = latencySamples[operation.operation];
      if (samples?.length) {
        const weight = metric.request_count / samples.length;
        total.latency_sample_groups.push({ samples, weight });
      }
    }
  }
  const metrics: Record<string, TelemetryMetric> = {};
  for (const [operation, total] of Object.entries(totals)) {
    const p99 = weightedPercentile(
      total.latency_sample_groups,
      0.99 * total.request_count
    );
    metrics[operation] = {
      request_count: total.request_count,
      success_count: total.success_count,
      error_count: total.error_count,
      avg_latency_ms: total.request_count
        ? total.weighted_avg / total.request_count
        : 0,
      p99_latency_ms: p99,
      max_latency_ms: total.max_latency_ms,
    };
  }
  return {
    aggregated: { start_time: start, end_time: end, metrics },
    snapshot_count: snapshots.length,
  };
}

function detailSnapshots(snapshots: TelemetrySnapshot[]) {
  return snapshots.map(snapshot => {
    const metrics: Record<string, TelemetryMetric> = {};
    for (const operation of snapshot.metrics) {
      metrics[operation.operation] = operation.global;
    }
    return {
      timestamp: snapshot.timestamp,
      end_time: snapshot.end_time,
      metrics,
    };
  });
}
