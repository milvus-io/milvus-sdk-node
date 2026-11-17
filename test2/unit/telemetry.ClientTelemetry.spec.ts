import {
  ClientTelemetryManager,
  newClientRequestId,
} from '../../milvus/telemetry';
import { status as grpcStatus } from '@grpc/grpc-js';

describe('ClientTelemetryManager', () => {
  it('matches the cross-SDK persistent command hash vector', () => {
    expect(
      ClientTelemetryManager.calculateConfigHash([
        {
          command_id: 'cfg-b',
          command_type: 'push_config',
          payload: Buffer.from('{"sampling_rate":0.5}'),
          persistent: true,
        },
        {
          command_id: 'cfg-a',
          command_type: 'push_config',
          payload: Buffer.from('{"heartbeat_interval_ms":5000}'),
          persistent: true,
        },
      ])
    ).toBe('a271ff0bb1941777');
  });

  it('sorts persistent command IDs by UTF-8 bytes, not host locale', () => {
    expect(
      ClientTelemetryManager.calculateConfigHash([
        {
          command_id: 'a',
          command_type: 'push_config',
          payload: Buffer.from('A'),
          persistent: true,
        },
        {
          command_id: 'Z',
          command_type: 'push_config',
          payload: Buffer.from('B'),
          persistent: true,
        },
      ])
    ).toBe('0e793afed772d6a5');
  });

  it('applies built-in commands and deduplicates command IDs', async () => {
    const manager = new ClientTelemetryManager({
      sender: async () => ({ status: { error_code: 'Success' } }),
      config: { enabled: false },
    });
    let calls = 0;
    manager.registerCommandHandler('custom', command => {
      calls += 1;
      return { command_id: command.command_id, success: true };
    });

    await manager.processCommands([
      {
        command_id: 'config',
        command_type: 'push_config',
        payload: Buffer.from(
          '{"heartbeat_interval_ms":5000,"sampling_rate":0.25}'
        ),
        create_time: 1,
        persistent: true,
      },
      {
        command_id: 'custom',
        command_type: 'custom',
        create_time: 2,
      },
    ]);
    await manager.processCommands([
      {
        command_id: 'custom',
        command_type: 'custom',
        create_time: 2,
      },
    ]);
    await manager.processCommands([
      {
        command_id: 'custom',
        command_type: 'custom',
        create_time: 2,
      },
    ]);

    expect(manager.getConfig().heartbeatIntervalMs).toBe(5000);
    expect(manager.getConfig().samplingRate).toBe(0.25);
    expect(manager.lastCommandTimestamp).toBe(2);
    expect(manager.configHash).not.toBe('');
    expect(calls).toBe(1);
    manager.stop();
  });

  it('retains command IDs at the cursor timestamp for exact deduplication', async () => {
    const manager = new ClientTelemetryManager({
      sender: async () => ({ status: { error_code: 'Success' } }),
      config: { enabled: false },
    });
    const executed: string[] = [];
    manager.registerCommandHandler('custom', command => {
      executed.push(command.command_id);
      return { command_id: command.command_id, success: true };
    });

    await manager.processCommands([
      {
        command_id: 'equal-a',
        command_type: 'custom',
        create_time: 10,
      },
    ]);
    await manager.processCommands([
      {
        command_id: 'equal-b',
        command_type: 'custom',
        create_time: 10,
      },
      {
        command_id: 'equal-a',
        command_type: 'custom',
        create_time: 10,
      },
    ]);

    expect(executed).toEqual(['equal-a', 'equal-b']);
    expect(manager.lastCommandTimestamp).toBe(10);
    expect([...(manager as any).executedCommands.keys()]).toEqual([
      'equal-a',
      'equal-b',
    ]);
    manager.stop();
  });

  it.each([
    ['wrong', { command_id: 'wrong-id', success: true }],
    ['empty', { command_id: '', success: true }],
    ['missing', undefined],
  ])(
    'keeps the server command ID when a custom handler returns a %s reply',
    async (_case, customReply) => {
      const manager = new ClientTelemetryManager({
        sender: async () => ({ status: { error_code: 'Success' } }),
        config: { enabled: false },
      });
      manager.registerCommandHandler('custom', (() => customReply) as any);

      await manager.processCommands([
        {
          command_id: 'server-command-id',
          command_type: 'custom',
          create_time: 1,
        },
      ]);

      expect((manager as any).pendingReplies[0]).toEqual(
        expect.objectContaining({
          command_id: 'server-command-id',
          success: customReply ? true : false,
        })
      );
      expect(manager.lastCommandTimestamp).toBe(1);
      manager.stop();
    }
  );

  it('rejects invalid heartbeat intervals without changing the current interval', async () => {
    expect(
      () =>
        new ClientTelemetryManager({
          sender: async () => ({ status: { error_code: 'Success' } }),
          config: { heartbeatIntervalMs: Number.NaN },
        })
    ).toThrow('heartbeatIntervalMs must be a finite positive number');

    const manager = new ClientTelemetryManager({
      sender: async () => ({ status: { error_code: 'Success' } }),
      config: { enabled: false, heartbeatIntervalMs: 5000 },
    });
    const reply = await (manager as any).handleCommand({
      command_id: 'invalid-config',
      command_type: 'push_config',
      payload: Buffer.from('{"heartbeat_interval_ms":"not-a-number"}'),
    });

    expect(reply.success).toBe(false);
    expect(reply.error_message).toContain('heartbeat_interval_ms');
    expect(manager.getConfig().heartbeatIntervalMs).toBe(5000);
    manager.stop();
  });

  it('applies push_config atomically and reports applied and ignored keys', async () => {
    const manager = new ClientTelemetryManager({
      sender: async () => ({ status: { error_code: 'Success' } }),
      config: {
        enabled: true,
        heartbeatIntervalMs: 5000,
        samplingRate: 0.75,
      },
    });

    const rejected = await (manager as any).handleCommand({
      command_id: 'invalid-combined-config',
      command_type: 'push_config',
      payload: Buffer.from(
        '{"enabled":false,"heartbeat_interval_ms":-1,"sampling_rate":0.1}'
      ),
    });
    expect(rejected.success).toBe(false);
    expect(manager.getConfig()).toEqual(
      expect.objectContaining({
        enabled: true,
        heartbeatIntervalMs: 5000,
        samplingRate: 0.75,
      })
    );

    // ttl_seconds belongs to the server-side push API and never reaches clients by
    // design: a stray value is reported as ignored, never validated.
    const strayTtl = await (manager as any).handleCommand({
      command_id: 'stray-ttl',
      command_type: 'push_config',
      payload: Buffer.from('{"enabled":false,"ttl_seconds":"60"}'),
    });
    expect(strayTtl.success).toBe(true);
    expect(JSON.parse(strayTtl.payload.toString())).toEqual({
      applied: ['enabled'],
      ignored: ['ttl_seconds'],
    });
    expect(manager.getConfig().enabled).toBe(false);

    const applied = await (manager as any).handleCommand({
      command_id: 'valid-config',
      command_type: 'push_config',
      payload: Buffer.from(
        '{"sampling_rate":1.5,"enabled":false,"ttl_seconds":60,"future_key":1}'
      ),
    });
    expect(applied.success).toBe(true);
    expect(JSON.parse(applied.payload.toString())).toEqual({
      applied: ['enabled', 'sampling_rate'],
      ignored: ['future_key', 'ttl_seconds'],
    });
    expect(manager.getConfig()).toEqual(
      expect.objectContaining({ enabled: false, samplingRate: 1 })
    );
    manager.stop();
  });

  it('serializes concurrent command batches before deduplicating IDs', async () => {
    const manager = new ClientTelemetryManager({
      sender: async () => ({ status: { error_code: 'Success' } }),
      config: { enabled: false },
    });
    let calls = 0;
    let release!: () => void;
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    manager.registerCommandHandler('slow', async command => {
      calls += 1;
      await gate;
      return { command_id: command.command_id, success: true };
    });
    const command = {
      command_id: 'same-id',
      command_type: 'slow',
      create_time: 1,
    };

    const first = manager.processCommands([command]);
    const second = manager.processCommands([command]);
    release();
    await Promise.all([first, second]);

    expect(calls).toBe(1);
    manager.stop();
  });

  it('fails recursive command processing without deadlocking the queue', async () => {
    const manager = new ClientTelemetryManager({
      sender: async () => ({ status: { error_code: 'Success' } }),
      config: { enabled: false },
    });
    let innerCalls = 0;
    let laterCalls = 0;
    manager.registerCommandHandler('outer', async command => {
      await manager.processCommands([
        {
          command_id: 'inner-id',
          command_type: 'inner',
          create_time: 1,
        },
      ]);
      return { command_id: command.command_id, success: true };
    });
    manager.registerCommandHandler('inner', command => {
      innerCalls += 1;
      return { command_id: command.command_id, success: true };
    });
    manager.registerCommandHandler('later', command => {
      laterCalls += 1;
      return { command_id: command.command_id, success: true };
    });

    await manager.processCommands([
      { command_id: 'outer-id', command_type: 'outer', create_time: 1 },
    ]);
    await manager.processCommands([
      { command_id: 'later-id', command_type: 'later', create_time: 2 },
    ]);

    expect(innerCalls).toBe(0);
    expect(laterCalls).toBe(1);
    expect((manager as any).pendingReplies).toEqual([
      expect.objectContaining({
        command_id: 'outer-id',
        success: false,
        error_message:
          'processCommands cannot be called recursively from a command handler',
      }),
      expect.objectContaining({ command_id: 'later-id', success: true }),
    ]);
    manager.stop();
  });

  it('strictly validates collection_metrics payloads', async () => {
    const manager = new ClientTelemetryManager({
      sender: async () => ({ status: { error_code: 'Success' } }),
      config: { enabled: false },
    });
    const malformed = await (manager as any).handleCommand({
      command_id: 'bad-collections',
      command_type: 'collection_metrics',
      payload: Buffer.from('{"enabled":false,"collections":"books"}'),
    });

    expect(malformed.success).toBe(false);
    expect(malformed.error_message).toContain('array of strings');
    manager.stop();
  });

  it('returns operation-keyed latency detail metrics', async () => {
    const manager = new ClientTelemetryManager({
      sender: async () => ({ status: { error_code: 'Success' } }),
    });
    manager.recordOperation({
      operation: 'Search',
      collection: 'books',
      startTime: performance.now() - 5,
    });
    (manager as any).createSnapshot();
    const snapshot = manager.getMetricsSnapshots()[0];

    const reply = await (manager as any).handleCommand({
      command_id: 'latency-detail',
      command_type: 'show_latency_history',
      payload: Buffer.from(
        JSON.stringify({
          start_time: new Date(snapshot.timestamp - 1).toISOString(),
          end_time: new Date(snapshot.end_time + 1).toISOString(),
          detail: true,
        })
      ),
    });
    const body = JSON.parse(reply.payload.toString());

    expect(reply.success).toBe(true);
    expect(body.total_snapshots).toBe(1);
    expect(Array.isArray(body.snapshots[0].metrics)).toBe(false);
    expect(body.snapshots[0].metrics.Search).toEqual(
      expect.objectContaining({
        request_count: 1,
        success_count: 1,
        error_count: 0,
      })
    );
    manager.stop();
  });

  it('aggregates p99 from bounded cross-window latency samples', async () => {
    const manager = new ClientTelemetryManager({
      sender: async () => ({ status: { error_code: 'Success' } }),
    });
    for (let index = 0; index < 256; index += 1) {
      manager.recordOperation({
        operation: 'Search',
        collection: 'books',
        startTime: performance.now() - 1,
      });
    }
    (manager as any).createSnapshot();
    for (let index = 0; index < 256; index += 1) {
      manager.recordOperation({
        operation: 'Search',
        collection: 'books',
        startTime: performance.now() - 100,
      });
    }
    (manager as any).createSnapshot();

    const snapshots = manager.getMetricsSnapshots();
    const retainedSamples = snapshots.map(
      snapshot => (manager as any).snapshotLatencySamples.get(snapshot).Search
    );
    expect(
      retainedSamples.every(samples => samples instanceof Float64Array)
    ).toBe(true);
    expect(retainedSamples.map(samples => samples.length)).toEqual([128, 128]);
    expect(JSON.stringify(snapshots)).not.toContain('latency_samples');

    const reply = await (manager as any).handleCommand({
      command_id: 'latency-aggregate',
      command_type: 'show_latency_history',
      payload: Buffer.from(
        JSON.stringify({
          start_time: new Date(snapshots[0].timestamp - 1).toISOString(),
          end_time: new Date(
            snapshots[snapshots.length - 1].end_time + 1
          ).toISOString(),
          detail: false,
        })
      ),
    });
    const body = JSON.parse(reply.payload.toString());
    const search = body.aggregated.metrics.Search;

    expect(reply.success).toBe(true);
    expect(body.snapshot_count).toBe(2);
    expect(search.request_count).toBe(512);
    expect(search.avg_latency_ms).toBeGreaterThan(40);
    expect(search.avg_latency_ms).toBeLessThan(70);
    // Averaging the two window p99s would land near 50 ms. The combined p99
    // belongs to the equally sized slow window.
    expect(search.p99_latency_ms).toBeGreaterThan(90);
    manager.stop();
  });

  it('generates a lowercase 128-bit client request ID', () => {
    expect(newClientRequestId()).toMatch(/^[0-9a-f]{32}$/);
  });

  it('backs off when the telemetry service is unimplemented', async () => {
    const manager = new ClientTelemetryManager({
      sender: async () => {
        throw Object.assign(new Error('unimplemented'), {
          code: grpcStatus.UNIMPLEMENTED,
        });
      },
    });

    await (manager as any).sendHeartbeat();

    expect(manager.isSupported()).toBe(false);
    manager.stop();
  });

  it('clears unsupported backoff on a real response with a business error', async () => {
    let calls = 0;
    const manager = new ClientTelemetryManager({
      sender: async () => {
        calls += 1;
        if (calls === 1) {
          throw Object.assign(new Error('unimplemented'), {
            code: grpcStatus.UNIMPLEMENTED,
          });
        }
        return { status: { code: 1, reason: 'not ready' } };
      },
    });

    await (manager as any).sendHeartbeat();
    expect(manager.isSupported()).toBe(false);
    await (manager as any).sendHeartbeat();

    expect(manager.isSupported()).toBe(true);
    expect(manager.lastHeartbeatError).toEqual(
      expect.objectContaining({ message: 'not ready' })
    );
    manager.stop();
  });

  it('keeps control-plane heartbeats alive while operation telemetry is disabled', async () => {
    const disableCommand = {
      command_id: 'disable',
      command_type: 'push_config',
      payload: Buffer.from('{"enabled":false}'),
      create_time: 1,
      persistent: true,
    };
    const enableCommand = {
      command_id: 'enable',
      command_type: 'push_config',
      payload: Buffer.from('{"enabled":true}'),
      create_time: 2,
      persistent: true,
    };
    const requests: any[] = [];
    let releaseEnable!: () => void;
    const enableGate = new Promise<void>(resolve => {
      releaseEnable = resolve;
    });
    let secondHeartbeat!: () => void;
    const secondHeartbeatReceived = new Promise<void>(resolve => {
      secondHeartbeat = resolve;
    });
    let thirdHeartbeat!: () => void;
    const thirdHeartbeatReceived = new Promise<void>(resolve => {
      thirdHeartbeat = resolve;
    });
    const manager = new ClientTelemetryManager({
      config: { heartbeatIntervalMs: 100 },
      sender: async request => {
        requests.push(request);
        if (requests.length === 1) {
          return {
            status: { error_code: 'Success' },
            commands: [disableCommand],
          };
        }
        if (requests.length === 2) {
          secondHeartbeat();
          await enableGate;
          return {
            status: { error_code: 'Success' },
            commands: [enableCommand],
          };
        }
        thirdHeartbeat();
        return { status: { error_code: 'Success' } };
      },
    });
    manager.recordOperation({
      operation: 'Search',
      collection: 'books',
      startTime: performance.now() - 1,
    });

    manager.start();
    while (manager.getConfig().enabled) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    await secondHeartbeatReceived;
    expect(manager.getConfig().enabled).toBe(false);
    manager.recordOperation({
      operation: 'Search',
      collection: 'books',
      startTime: performance.now() - 1,
    });
    releaseEnable();
    await thirdHeartbeatReceived;
    manager.stop();

    expect(requests[0].metrics).toHaveLength(1);
    expect(requests[1].metrics).toEqual([]);
    expect(requests[1].command_replies).toEqual([
      expect.objectContaining({ command_id: 'disable', success: true }),
    ]);
    expect(requests[1].config_hash).toBe(
      ClientTelemetryManager.calculateConfigHash([disableCommand])
    );
    expect(requests[2].metrics).toEqual([]);
    expect(requests[2].command_replies).toEqual([
      expect.objectContaining({ command_id: 'enable', success: true }),
    ]);
    expect(requests[2].config_hash).toBe(
      ClientTelemetryManager.calculateConfigHash([enableCommand])
    );
    expect(manager.getConfig().enabled).toBe(true);
  });

  it('does not heartbeat when the initial config explicitly opts out', async () => {
    const sender = jest.fn(async () => ({
      status: { error_code: 'Success' },
    }));
    const manager = new ClientTelemetryManager({
      sender,
      config: { enabled: false, heartbeatIntervalMs: 1 },
    });

    manager.start();
    await new Promise(resolve => setTimeout(resolve, 10));
    manager.stop();

    expect(sender).not.toHaveBeenCalled();
  });

  it('chunks heartbeat delays beyond the Node timer limit', async () => {
    jest.useFakeTimers();
    const maxTimerDelayMs = 2_147_483_647;
    const sender = jest.fn(async () => ({
      status: { error_code: 'Success' },
    }));
    const manager = new ClientTelemetryManager({
      sender,
      config: { heartbeatIntervalMs: maxTimerDelayMs + 1_000 },
    });
    try {
      (manager as any).scheduleNextHeartbeat(maxTimerDelayMs + 1_000);

      jest.advanceTimersByTime(maxTimerDelayMs);
      expect(sender).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1_000);
      await Promise.resolve();
      expect(sender).toHaveBeenCalledTimes(1);
    } finally {
      manager.stop();
      jest.useRealTimers();
    }
  });

  it('continues the heartbeat loop after an unexpected collector failure', async () => {
    let heartbeatObserved!: () => void;
    const heartbeat = new Promise<void>(resolve => {
      heartbeatObserved = resolve;
    });
    const sender = jest.fn(async () => {
      heartbeatObserved();
      return { status: { error_code: 'Success' } };
    });
    const manager = new ClientTelemetryManager({
      sender,
      config: { heartbeatIntervalMs: 1 },
    });
    const createSnapshot = (manager as any).createSnapshot.bind(manager);
    let attempts = 0;
    (manager as any).createSnapshot = jest.fn(() => {
      attempts += 1;
      if (attempts === 1) {
        throw new Error('collector failed');
      }
      createSnapshot();
    });

    manager.start();
    await heartbeat;
    manager.stop();

    expect(attempts).toBeGreaterThanOrEqual(2);
    expect(sender).toHaveBeenCalled();
  });

  it('retains at most one hour of snapshots with a hard memory cap', () => {
    const manager = new ClientTelemetryManager({
      sender: async () => ({ status: { error_code: 'Success' } }),
    });
    const now = Date.now();
    const snapshots = (manager as any).snapshots as any[];
    const latencySamples = (manager as any).snapshotLatencySamples as Map<
      object,
      object
    >;
    const appendSnapshot = (snapshot: any) => {
      snapshots.push(snapshot);
      latencySamples.set(snapshot, { Search: new Float64Array([1]) });
    };
    appendSnapshot({
      timestamp: now - 60 * 60 * 1000 - 2,
      end_time: now - 60 * 60 * 1000 - 1,
      metrics: [],
    });
    for (let index = 0; index < 4098; index += 1) {
      appendSnapshot({
        timestamp: now - 1000 + index,
        end_time: now - 999 + index,
        metrics: [],
        index,
      });
    }

    const retained = manager.getMetricsSnapshots() as any[];

    expect(retained).toHaveLength(4096);
    expect(retained[0].index).toBe(2);
    expect(latencySamples.size).toBe(4096);
    expect(
      retained.every(snapshot => snapshot.end_time >= now - 60 * 60 * 1000)
    ).toBe(true);
    manager.stop();
  });

  it('drops a stale endpoint response without mutating telemetry state', async () => {
    let endpointEpoch = 1;
    let resolveHeartbeat!: (response: any) => void;
    const sender = jest.fn(
      () =>
        new Promise<any>(resolve => {
          resolveHeartbeat = resolve;
        })
    );
    const manager = new ClientTelemetryManager({
      sender,
      senderEpochProvider: () => endpointEpoch,
    });
    manager.registerCommandHandler('baseline', command => ({
      command_id: command.command_id,
      success: true,
    }));
    await manager.processCommands([
      {
        command_id: 'baseline-command',
        command_type: 'baseline',
        payload: Buffer.from('baseline'),
        create_time: 1,
        persistent: true,
      },
    ]);
    (manager as any).unsupportedStreak = 1;
    const oldError = new Error('old endpoint was unsupported');
    manager.lastHeartbeatError = oldError;

    const before = {
      config: manager.getConfig(),
      configHash: manager.configHash,
      lastCommandTimestamp: manager.lastCommandTimestamp,
      pendingReplyIds: (manager as any).pendingReplies.map(
        (reply: any) => reply.command_id
      ),
      executedCommandIds: [...(manager as any).executedCommands.keys()],
      snapshots: manager.getMetricsSnapshots(),
    };

    const heartbeat = (manager as any).sendHeartbeat();
    await Promise.resolve();
    expect(sender).toHaveBeenCalledTimes(1);

    // Publish a new endpoint before the old transport completes.
    endpointEpoch += 1;
    resolveHeartbeat({
      status: { error_code: 'Success' },
      commands: [
        {
          command_id: 'stale-config',
          command_type: 'push_config',
          payload: Buffer.from(
            '{"enabled":false,"heartbeat_interval_ms":1234,"sampling_rate":0.1}'
          ),
          create_time: 2,
          persistent: true,
        },
      ],
    });
    await heartbeat;

    expect(manager.getConfig()).toEqual(before.config);
    expect(manager.configHash).toBe(before.configHash);
    expect(manager.lastCommandTimestamp).toBe(before.lastCommandTimestamp);
    expect(
      (manager as any).pendingReplies.map((reply: any) => reply.command_id)
    ).toEqual(before.pendingReplyIds);
    expect([...(manager as any).executedCommands.keys()]).toEqual(
      before.executedCommandIds
    );
    expect(manager.getMetricsSnapshots()).toEqual(before.snapshots);
    expect(manager.isSupported()).toBe(false);
    expect(manager.lastHeartbeatError).toBe(oldError);
    manager.stop();
  });

  it('stops an old endpoint batch when a handler changes sender epoch', async () => {
    let endpointEpoch = 1;
    const commands = [
      {
        command_id: 'switch-generation',
        command_type: 'switch-generation',
        create_time: 1,
        persistent: true,
        payload: Buffer.from('switch'),
      },
      {
        command_id: 'followup',
        command_type: 'followup',
        create_time: 2,
        persistent: true,
        payload: Buffer.from('followup'),
      },
    ];
    const manager = new ClientTelemetryManager({
      sender: async () => ({
        status: { error_code: 'Success' },
        commands,
      }),
      senderEpochProvider: () => endpointEpoch,
    });
    let switchCalls = 0;
    let followupCalls = 0;
    manager.registerCommandHandler('switch-generation', async () => {
      switchCalls += 1;
      await Promise.resolve();
      endpointEpoch += 1;
      return { command_id: 'wrong-id', success: true };
    });
    manager.registerCommandHandler('followup', command => {
      followupCalls += 1;
      return { command_id: command.command_id, success: true };
    });

    await (manager as any).sendHeartbeat();

    expect(switchCalls).toBe(1);
    expect(followupCalls).toBe(0);
    expect(manager.lastCommandTimestamp).toBe(0);
    expect(manager.configHash).toBe('');
    expect((manager as any).pendingReplies).toEqual([
      expect.objectContaining({
        command_id: 'switch-generation',
        success: true,
      }),
    ]);

    await (manager as any).sendHeartbeat();

    expect(switchCalls).toBe(1);
    expect(followupCalls).toBe(1);
    expect(manager.lastCommandTimestamp).toBe(2);
    expect(manager.configHash).toBe(
      ClientTelemetryManager.calculateConfigHash(commands)
    );
    manager.stop();
  });

  it('filters snapshot collection metrics against the current wire scope', async () => {
    let heartbeat: any;
    const manager = new ClientTelemetryManager({
      sender: async request => {
        heartbeat = request;
        return { status: { error_code: 'Success' } };
      },
    });
    await manager.processCommands([
      {
        command_id: 'scope-on',
        command_type: 'collection_metrics',
        payload: Buffer.from('{"enabled":true,"collections":["books"]}'),
        create_time: 1,
      },
    ]);
    manager.recordOperation({
      operation: 'Search',
      collection: 'books',
      startTime: performance.now(),
    });
    (manager as any).createSnapshot();
    await manager.processCommands([
      {
        command_id: 'scope-off',
        command_type: 'collection_metrics',
        payload: Buffer.from('{"enabled":false,"collections":["books"]}'),
        create_time: 2,
      },
    ]);

    await (manager as any).sendHeartbeat();

    expect(heartbeat.metrics[0].collection_metrics).toEqual({});
    manager.stop();
  });

  it('requires RFC3339 timestamps and a boolean history detail flag', async () => {
    const manager = new ClientTelemetryManager({
      sender: async () => ({ status: { error_code: 'Success' } }),
    });
    const missingZone = await (manager as any).handleCommand({
      command_id: 'missing-zone',
      command_type: 'show_latency_history',
      payload: Buffer.from(
        '{"start_time":"2026-01-01T00:00:00","end_time":"2026-01-01T00:01:00Z"}'
      ),
    });
    const stringDetail = await (manager as any).handleCommand({
      command_id: 'string-detail',
      command_type: 'show_latency_history',
      payload: Buffer.from(
        '{"start_time":"2026-01-01T00:00:00Z","end_time":"2026-01-01T00:01:00Z","detail":"false"}'
      ),
    });

    expect(missingZone.success).toBe(false);
    expect(missingZone.error_message).toContain('RFC3339');
    expect(stringDetail.success).toBe(false);
    expect(stringDetail.error_message).toContain('boolean');
    manager.stop();
  });

  it('truncates a single oversized error reply', async () => {
    const manager = new ClientTelemetryManager({
      sender: async () => ({ status: { error_code: 'Success' } }),
    });
    manager.recordOperation({
      operation: 'Query',
      collection: 'books',
      startTime: performance.now(),
      error: new Error('x'.repeat(2 * 1024 * 1024)),
    });

    const reply = await (manager as any).handleCommand({
      command_id: 'errors',
      command_type: 'show_errors',
    });

    expect(reply.success).toBe(true);
    expect(reply.payload.length).toBeLessThanOrEqual(1024 * 1024);
    manager.stop();
  });

  it('bounds an oversized non-message error field without looping', async () => {
    const manager = new ClientTelemetryManager({
      sender: async () => ({ status: { error_code: 'Success' } }),
    });
    manager.recordOperation({
      operation: 'Query',
      collection: 'c'.repeat(2 * 1024 * 1024),
      startTime: performance.now(),
      error: new Error('xy'),
    });

    const reply = await (manager as any).handleCommand({
      command_id: 'errors-with-large-collection',
      command_type: 'show_errors',
    });
    const errors = JSON.parse(reply.payload.toString());

    expect(reply.success).toBe(true);
    expect(reply.payload.length).toBeLessThanOrEqual(1024 * 1024);
    expect(errors[0].error_msg).toBe('xy');
    expect(errors[0].collection).toContain('...(truncated)');
    manager.stop();
  });

  it('returns an empty payload when there are no recent errors', async () => {
    const manager = new ClientTelemetryManager({
      sender: async () => ({ status: { error_code: 'Success' } }),
    });

    const reply = await (manager as any).handleCommand({
      command_id: 'no-errors',
      command_type: 'show_errors',
    });

    expect(reply.success).toBe(true);
    expect(reply.payload).toHaveLength(0);
    manager.stop();
  });
});
