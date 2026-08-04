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

    expect(manager.getConfig().heartbeatIntervalMs).toBe(5000);
    expect(manager.getConfig().samplingRate).toBe(0.25);
    expect(manager.lastCommandTimestamp).toBe(2);
    expect(manager.configHash).not.toBe('');
    expect(calls).toBe(1);
    manager.stop();
  });

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
    expect(reply.error_message).toContain('finite positive number');
    expect(manager.getConfig().heartbeatIntervalMs).toBe(5000);
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
});
