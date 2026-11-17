import { MilvusClient } from '../../milvus';

const clients = new Set<MilvusClient>();

// Root teardown runs after a suite's collection/database cleanup, including on failure.
afterAll(async () => {
  const outcomes = await Promise.allSettled(
    [...clients].map(client => client.closeConnection())
  );
  clients.clear();
  const failures = outcomes.filter(
    (outcome): outcome is PromiseRejectedResult => outcome.status === 'rejected'
  );
  if (failures.length)
    throw new Error(
      `Client cleanup failed: ${failures.map(outcome => String(outcome.reason)).join('\n')}`
    );
});

/** Manage real integration clients; constructor behavior remains covered by dedicated unit tests. */
export function createClient(
  ...args: ConstructorParameters<typeof MilvusClient>
) {
  const client = new MilvusClient(...args);
  const config = args[0];
  if (typeof config === 'string' || !config.__SKIP_CONNECT__)
    clients.add(client);
  return client;
}
