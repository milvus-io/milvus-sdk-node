import {
  MilvusClient,
  isGlobalEndpoint,
  FAILOVER_HANDLER_KEY,
} from '../../milvus';

/**
 * Integration-style tests for global cluster connection lifecycle.
 * These tests mock the topology REST endpoint and verify client behavior
 * without requiring a real Milvus global cluster.
 *
 * TODO: Add full integration tests with a real global cluster endpoint
 * when available (requires global endpoint URL + token).
 */

const validTopologyResponse = {
  code: 0,
  data: {
    version: '1',
    clusters: [
      { clusterId: 'c1', endpoint: 'primary-host:19530', capability: 3 },
      { clusterId: 'c2', endpoint: 'secondary-host:19530', capability: 1 },
    ],
  },
};

describe('Global connection lifecycle', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should detect global cluster from address', () => {
    expect(
      isGlobalEndpoint('https://glo-xxx.global-cluster.xyz')
    ).toBe(true);
    expect(
      isGlobalEndpoint('https://in01-xxx.zilliz.com')
    ).toBe(false);
  });

  it('should resolve primary endpoint during initialization', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(validTopologyResponse),
    }) as any;

    const client = new MilvusClient({
      address: 'https://glo-xxx.global-cluster.xyz',
      token: 'test-token',
      __SKIP_CONNECT__: true,
      isGlobal: true,
    });

    // The client should be detected as global
    expect(client.isGlobal).toBe(true);
    expect(client.globalEndpoint).toBe(
      'https://glo-xxx.global-cluster.xyz'
    );
  });

  it('should not treat regular addresses as global', () => {
    const client = new MilvusClient({
      address: 'localhost:19530',
      __SKIP_CONNECT__: true,
    });

    expect(client.isGlobal).toBe(false);
    expect(client.globalEndpoint).toBe('');
  });

  it('should respect explicit isGlobal=false override', () => {
    const client = new MilvusClient({
      address: 'https://glo-xxx.global-cluster.xyz',
      isGlobal: false,
      __SKIP_CONNECT__: true,
    });

    expect(client.isGlobal).toBe(false);
  });

  it('should respect explicit isGlobal=true override', () => {
    const client = new MilvusClient({
      address: 'https://custom.endpoint.com',
      isGlobal: true,
      __SKIP_CONNECT__: true,
    });

    expect(client.isGlobal).toBe(true);
    expect(client.globalEndpoint).toBe('https://custom.endpoint.com');
  });

  it('should not create channelPool in constructor for global clients', () => {
    const client = new MilvusClient({
      address: 'https://glo-xxx.global-cluster.xyz',
      token: 'test-token',
      __SKIP_CONNECT__: true,
    });

    // Pool should not be created yet (deferred to connect())
    expect(client.channelPool).toBeUndefined();
  });

  it('should create channelPool in constructor for regular clients', () => {
    const client = new MilvusClient({
      address: 'localhost:19530',
      __SKIP_CONNECT__: true,
    });

    // Pool should be created immediately
    expect(client.channelPool).toBeDefined();
  });

  it('should attach failover handler to pool after global init', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(validTopologyResponse),
    }) as any;

    const client = new MilvusClient({
      address: 'https://glo-xxx.global-cluster.xyz',
      token: 'test-token',
      __SKIP_CONNECT__: true,
    });

    // Manually call _initGlobalConnection (normally called by connect())
    try {
      await (client as any)._initGlobalConnection('test');
    } catch {
      // Will fail at _getServerInfo since no real server, that's expected
    }

    // Pool should now exist with failover handler
    expect(client.channelPool).toBeDefined();
    expect((client.channelPool as any)[FAILOVER_HANDLER_KEY]).toBeDefined();
  });

  it('should start topology refresher after global init', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(validTopologyResponse),
    }) as any;

    const client = new MilvusClient({
      address: 'https://glo-xxx.global-cluster.xyz',
      token: 'test-token',
      __SKIP_CONNECT__: true,
    });

    try {
      await (client as any)._initGlobalConnection('test');
    } catch {
      // Expected - no real server
    }

    expect(client.topologyRefresher).toBeDefined();
    expect(client.topologyRefresher!.isRunning()).toBe(true);

    // Clean up
    client.topologyRefresher!.stop();
  });

  it('should use primary endpoint as config.address after init', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(validTopologyResponse),
    }) as any;

    const client = new MilvusClient({
      address: 'https://glo-xxx.global-cluster.xyz',
      token: 'test-token',
      __SKIP_CONNECT__: true,
    });

    try {
      await (client as any)._initGlobalConnection('test');
    } catch {
      // Expected
    }

    // config.address should now be the primary cluster endpoint
    expect(client.config.address).toBe('primary-host:19530');

    // Clean up
    client.topologyRefresher?.stop();
  });

  it('should stop topology refresher on closeConnection', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(validTopologyResponse),
    }) as any;

    const client = new MilvusClient({
      address: 'https://glo-xxx.global-cluster.xyz',
      token: 'test-token',
      __SKIP_CONNECT__: true,
    });

    try {
      await (client as any)._initGlobalConnection('test');
    } catch {
      // Expected
    }

    expect(client.topologyRefresher!.isRunning()).toBe(true);

    await client.closeConnection();

    expect(client.topologyRefresher).toBeNull();
  });

  it('should serialize concurrent reconnect via isReconnecting flag', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(validTopologyResponse),
    }) as any;

    const client = new MilvusClient({
      address: 'https://glo-xxx.global-cluster.xyz',
      token: 'test-token',
      __SKIP_CONNECT__: true,
    });

    try {
      await (client as any)._initGlobalConnection('test');
    } catch {
      // Expected - no real server
    }

    // Access protected fields via cast for testing
    const c = client as any;

    // Verify initial state
    expect(c.isReconnecting).toBe(false);
    expect(c.reconnectingPromise).toBeNull();

    // Simulate an ongoing reconnect by setting the flag
    c.isReconnecting = true;
    let resolveReconnect!: () => void;
    c.reconnectingPromise = new Promise((resolve: any) => {
      resolveReconnect = resolve;
    });

    // Second call should wait for the existing promise, not start a new one
    const waitPromise = client.reconnectToPrimary();
    resolveReconnect();
    const result = await waitPromise;

    // Should return true (reconnect was handled by the first caller)
    expect(result).toBe(true);

    // Clean up
    c.isReconnecting = false;
    client.topologyRefresher?.stop();
  });
});
