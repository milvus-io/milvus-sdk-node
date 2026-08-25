import crypto from 'crypto';
import fetch from 'node-fetch';
import { MilvusClient, newClientRequestId } from '../../milvus';

const runE2E =
  process.env.MILVUS_TELEMETRY_E2E === 'true' ? describe : describe.skip;
const address = process.env.MILVUS_ADDRESS || '127.0.0.1:19530';
const telemetryApi =
  process.env.MILVUS_TELEMETRY_API || 'http://127.0.0.1:9091/api/v1/_telemetry';

runE2E('client telemetry local E2E', () => {
  jest.setTimeout(30_000);

  it('registers default telemetry automatically', async () => {
    const client = new MilvusClient({ address });
    try {
      const manager = client.getTelemetry();
      expect(manager.stableClientId).toBe(false);
      await waitFor(
        'default client registration',
        manager.clientId,
        state => state.status === 'active'
      );
    } finally {
      await client.closeConnection();
    }
  });

  it('round-trips metrics, commands, config, and request IDs', async () => {
    const clientId = `e2e-node-${crypto.randomUUID()}`;
    const client = new MilvusClient({
      address,
      telemetry: {
        heartbeatIntervalMs: 500,
        samplingRate: 1,
        clientId,
      },
    });

    try {
      const manager = client.getTelemetry();
      expect(manager.clientId).toBe(clientId);
      await waitFor(
        'client registration',
        clientId,
        state => state.status === 'active'
      );

      const analyzer = await client.runAnalyzer({
        text: 'hello milvus telemetry',
        analyzer_params: { type: 'standard' },
        with_detail: true,
      });
      expect(
        analyzer.results[0].tokens.map(token =>
          Buffer.from(token.token as any).toString()
        )
      ).toEqual(['hello', 'milvus', 'telemetry']);
      await waitFor('RunAnalyzer metric', clientId, state =>
        hasMetric(state, 'RunAnalyzer', 'success_count', 1)
      );

      const collectionsCommand = await pushCommand(
        clientId,
        'collection_metrics',
        { collections: ['*'], enabled: true }
      );
      expect((await waitForReply(clientId, collectionsCommand)).success).toBe(
        true
      );

      const requestId = newClientRequestId();
      const query = await client.query({
        collection_name: 'telemetry_e2e_missing',
        filter: 'id > 0',
        client_request_id: requestId,
      });
      expect(query.status.error_code).not.toBe('Success');
      await waitFor('failed Query collection metric', clientId, state =>
        hasMetric(state, 'Query', 'error_count', 1, 'telemetry_e2e_missing')
      );

      const errorsCommand = await pushCommand(clientId, 'show_errors', {
        max_count: 10,
      });
      const errorsReply = await waitForReply(clientId, errorsCommand);
      expect(errorsReply.success).toBe(true);
      expect(JSON.parse(errorsReply.payload)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            operation: 'Query',
            request_id: requestId,
          }),
        ])
      );

      const configPayload = {
        sampling_rate: 0.75,
        heartbeat_interval_ms: 600,
      };
      const configCommand = await pushCommand(
        clientId,
        'push_config',
        configPayload,
        true
      );
      expect((await waitForReply(clientId, configCommand)).success).toBe(true);
      expect(manager.configHash).toBe(
        crypto
          .createHash('sha256')
          .update(configCommand)
          .update('push_config')
          .update(JSON.stringify(configPayload))
          .digest('hex')
          .slice(0, 16)
      );
      expect(manager.lastCommandTimestamp).toBeGreaterThan(0);

      const getConfigReply = await waitForReply(
        clientId,
        await pushCommand(clientId, 'get_config', {})
      );
      const userConfig = JSON.parse(getConfigReply.payload).user_config;
      expect(userConfig.telemetry_sampling_rate).toBe(0.75);
      expect(userConfig.telemetry_heartbeat_interval_ms).toBe(600);
      expect(userConfig.all_collections_enabled).toBe(true);
    } finally {
      await client.closeConnection();
    }
  });
});

async function clientState(clientId: string): Promise<any | undefined> {
  const query = new URLSearchParams({
    client_id: clientId,
    include_metrics: 'true',
  });
  const response = await fetch(`${telemetryApi}/clients?${query}`);
  expect(response.ok).toBe(true);
  const body = (await response.json()) as any;
  return body.clients?.[0];
}

async function waitFor(
  label: string,
  clientId: string,
  predicate: (state: any) => boolean
): Promise<any> {
  const deadline = Date.now() + 15_000;
  let last: any;
  while (Date.now() < deadline) {
    last = await clientState(clientId);
    if (last && predicate(last)) {
      return last;
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(
    `Timed out waiting for ${label}; last=${JSON.stringify(last)}`
  );
}

async function pushCommand(
  clientId: string,
  commandType: string,
  payload: Record<string, unknown>,
  persistent = false
): Promise<string> {
  const response = await fetch(`${telemetryApi}/commands`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      command_type: commandType,
      target_client_id: clientId,
      payload,
      ttl_seconds: 30,
      persistent,
    }),
  });
  expect(response.ok).toBe(true);
  return ((await response.json()) as any).command_id;
}

async function waitForReply(clientId: string, commandId: string): Promise<any> {
  const state = await waitFor(
    `command reply ${commandId}`,
    clientId,
    candidate =>
      candidate.command_replies?.some(
        (reply: any) => reply.command_id === commandId
      )
  );
  return state.command_replies.find(
    (reply: any) => reply.command_id === commandId
  );
}

function hasMetric(
  state: any,
  operation: string,
  counter: string,
  minimum: number,
  collection?: string
): boolean {
  return (state.metrics || []).some((metric: any) => {
    if (
      metric.operation !== operation ||
      Number(metric.global?.[counter] || 0) < minimum
    ) {
      return false;
    }
    return !collection || Boolean(metric.collection_metrics?.[collection]);
  });
}
