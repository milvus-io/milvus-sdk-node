import crypto from 'crypto';
import os from 'os';
import { status as grpcStatus } from '@grpc/grpc-js';

const MAX_UNIMPLEMENTED_BACKOFF_MS = 30 * 60 * 1000;
const SAMPLE_BUFFER_SIZE = 1000;
const SNAPSHOT_LIMIT = 120;
const MAX_REPLY_BYTES = 1024 * 1024;
const SAMPLING_DENOMINATOR = 10_000;

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

  snapshot(operation: string): TelemetryOperationMetrics | undefined {
    const global = this.global.snapshot();
    if (!global) {
      return undefined;
    }
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
      operation,
      global,
      collection_metrics: collectionMetrics,
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
  private readonly collectors = new Map<string, OperationCollector>();
  private readonly errors: TelemetryError[] = [];
  private readonly snapshots: TelemetrySnapshot[] = [];
  private readonly pendingReplies: CommandReply[] = [];
  private readonly executedCommands = new Map<string, number>();
  private readonly handlers = new Map<string, CommandHandler>();
  private readonly enabledCollections = new Set<string>();
  private allCollectionsEnabled = false;
  private enabled: boolean;
  private heartbeatIntervalMs: number;
  private samplingRate: number;
  private readonly errorMaxCount: number;
  private samplingCounter = 0;
  private unsupportedStreak = 0;
  private timer?: NodeJS.Timeout;
  private stopped = false;
  private lastSnapshotEnd = 0;

  constructor(options: {
    sender: HeartbeatSender;
    config?: TelemetryConfig;
    sdkVersion?: string;
    userProvider?: () => string;
    databaseProvider?: () => string;
    configProvider?: () => Record<string, unknown>;
  }) {
    const config = options.config || {};
    this.sender = options.sender;
    this.sdkVersion = options.sdkVersion || '';
    this.userProvider = options.userProvider || (() => '');
    this.databaseProvider = options.databaseProvider || (() => '');
    this.configProvider = options.configProvider || (() => ({}));
    this.enabled = config.enabled ?? true;
    this.heartbeatIntervalMs = Number(config.heartbeatIntervalMs ?? 30_000);
    if (
      !Number.isFinite(this.heartbeatIntervalMs) ||
      this.heartbeatIntervalMs <= 0
    ) {
      throw new Error('heartbeatIntervalMs must be a finite positive number');
    }
    this.samplingRate = clamp(config.samplingRate ?? 1, 0, 1);
    this.errorMaxCount = Math.max(1, config.errorMaxCount ?? 100);
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
    return [...this.snapshots];
  }

  async processCommands(commands: ClientCommand[]) {
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
      if (reply) {
        this.pendingReplies.push(reply);
      }
    }
    for (const [id, timestamp] of this.executedCommands) {
      if (timestamp <= previousTimestamp) {
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
      .sort((left, right) => left.command_id.localeCompare(right.command_id));
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
    this.createSnapshot();
    await this.sendHeartbeat();
    if (this.stopped) {
      return;
    }
    this.timer = setTimeout(
      () => void this.heartbeatLoop(),
      this.nextHeartbeatDelay()
    );
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
    if (!this.enabled) {
      return;
    }
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
    try {
      const response = await this.sender({
        client_info: {
          sdk_type: 'nodejs',
          sdk_version: this.sdkVersion,
          local_time: new Date().toISOString(),
          user: this.userProvider(),
          host: os.hostname(),
          reserved,
        },
        report_timestamp: Date.now(),
        metrics: latest?.metrics || [],
        command_replies: replies,
        config_hash: this.configHash,
        last_command_timestamp: this.lastCommandTimestamp,
      });
      if (!responseSucceeded(response)) {
        throw new Error(response?.status?.reason || 'client heartbeat failed');
      }
      this.pendingReplies.splice(0, replies.length);
      this.lastHeartbeatError = undefined;
      this.unsupportedStreak = 0;
      await this.processCommands(response?.commands || []);
    } catch (error: any) {
      this.lastHeartbeatError = error;
      if (error?.code === grpcStatus.UNIMPLEMENTED) {
        this.unsupportedStreak += 1;
      }
    }
  }

  private shouldSample() {
    if (this.samplingRate >= 1) {
      return true;
    }
    if (this.samplingRate <= 0) {
      return false;
    }
    const threshold = Math.floor(this.samplingRate * SAMPLING_DENOMINATOR);
    this.samplingCounter += 1;
    return this.samplingCounter % SAMPLING_DENOMINATOR < threshold;
  }

  private createSnapshot() {
    if (!this.enabled) {
      return;
    }
    const metrics: TelemetryOperationMetrics[] = [];
    for (const [operation, collector] of this.collectors) {
      const metric = collector.snapshot(operation);
      if (metric) {
        metrics.push(metric);
      }
    }
    const now = Date.now();
    const start =
      !this.lastSnapshotEnd || this.lastSnapshotEnd > now
        ? now - this.heartbeatIntervalMs
        : this.lastSnapshotEnd;
    this.lastSnapshotEnd = now;
    this.snapshots.push({ timestamp: start, end_time: now, metrics });
    while (this.snapshots.length > SNAPSHOT_LIMIT) {
      this.snapshots.shift();
    }
  }

  private async handleCommand(command: ClientCommand): Promise<CommandReply> {
    const handler = this.handlers.get(command.command_type);
    if (!handler) {
      return failedReply(
        command.command_id,
        `unknown command type: ${command.command_type}`
      );
    }
    try {
      return await handler(command);
    } catch (error) {
      return failedReply(command.command_id, errorMessage(error));
    }
  }

  private registerDefaultHandlers() {
    this.registerCommandHandler('push_config', command => {
      const payload = parsePayload(command);
      let heartbeatIntervalMs: number | undefined;
      if ('heartbeat_interval_ms' in payload) {
        heartbeatIntervalMs = Number(payload.heartbeat_interval_ms);
        if (!Number.isFinite(heartbeatIntervalMs) || heartbeatIntervalMs <= 0) {
          throw new Error(
            'heartbeat_interval_ms must be a finite positive number'
          );
        }
      }
      if ('enabled' in payload) {
        this.enabled = Boolean(payload.enabled);
      }
      if (heartbeatIntervalMs !== undefined) {
        this.heartbeatIntervalMs = heartbeatIntervalMs;
      }
      if ('sampling_rate' in payload) {
        this.samplingRate = clamp(Number(payload.sampling_rate), 0, 1);
      }
      return successReply(command.command_id);
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
      const collections = Array.isArray(payload.collections)
        ? payload.collections.map(String)
        : [];
      const wildcard = collections.includes('*');
      if (payload.enabled) {
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
      let errors = this.getRecentErrors(Number(payload.max_count || 100)).map(
        error => ({ ...error })
      );
      let encoded = Buffer.from(JSON.stringify(errors));
      while (encoded.length > MAX_REPLY_BYTES && errors.length > 1) {
        errors = errors.slice(0, Math.max(1, Math.floor(errors.length / 2)));
        encoded = Buffer.from(JSON.stringify(errors));
      }
      while (
        encoded.length > MAX_REPLY_BYTES &&
        errors.length === 1 &&
        errors[0].error_msg.length > 1
      ) {
        errors[0].error_msg =
          errors[0].error_msg.slice(
            0,
            Math.max(1, Math.floor(errors[0].error_msg.length / 2))
          ) + '...(truncated)';
        encoded = Buffer.from(JSON.stringify(errors));
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
      if (!payload.start_time || !payload.end_time) {
        throw new Error('payload is required with start_time and end_time');
      }
      const start = Date.parse(String(payload.start_time));
      const end = Date.parse(String(payload.end_time));
      if (!Number.isFinite(start) || !Number.isFinite(end)) {
        throw new Error('invalid RFC3339 time range');
      }
      if (end < start) {
        throw new Error('end_time must be after start_time');
      }
      if (end - start > 60 * 60 * 1000) {
        throw new Error('time range cannot exceed 1 hour');
      }
      const snapshots = this.snapshots.filter(
        snapshot => snapshot.end_time >= start && snapshot.timestamp <= end
      );
      const body = payload.detail
        ? {
            snapshots: detailSnapshots(snapshots),
            total_snapshots: snapshots.length,
          }
        : aggregateSnapshots(snapshots, start, end);
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
  return payload.length ? JSON.parse(payload.toString()) : {};
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

function aggregateSnapshots(
  snapshots: TelemetrySnapshot[],
  start: number,
  end: number
) {
  const totals: Record<
    string,
    {
      request_count: number;
      success_count: number;
      error_count: number;
      weighted_avg: number;
      weighted_p99: number;
      max_latency_ms: number;
    }
  > = {};
  for (const snapshot of snapshots) {
    for (const operation of snapshot.metrics) {
      const metric = operation.global;
      const total = (totals[operation.operation] ||= {
        request_count: 0,
        success_count: 0,
        error_count: 0,
        weighted_avg: 0,
        weighted_p99: 0,
        max_latency_ms: 0,
      });
      total.request_count += metric.request_count;
      total.success_count += metric.success_count;
      total.error_count += metric.error_count;
      total.weighted_avg += metric.avg_latency_ms * metric.request_count;
      total.weighted_p99 += metric.p99_latency_ms * metric.request_count;
      total.max_latency_ms = Math.max(
        total.max_latency_ms,
        metric.max_latency_ms
      );
    }
  }
  const metrics: Record<string, TelemetryMetric> = {};
  for (const [operation, total] of Object.entries(totals)) {
    metrics[operation] = {
      request_count: total.request_count,
      success_count: total.success_count,
      error_count: total.error_count,
      avg_latency_ms: total.request_count
        ? total.weighted_avg / total.request_count
        : 0,
      p99_latency_ms: total.request_count
        ? total.weighted_p99 / total.request_count
        : 0,
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
