import {
  MilvusClient,
  isGlobalEndpoint,
  FAILOVER_HANDLER_KEY,
  CONNECT_STATUS,
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
    expect(isGlobalEndpoint('https://glo-xxx.global-cluster.xyz')).toBe(true);
    expect(isGlobalEndpoint('https://in01-xxx.zilliz.com')).toBe(false);
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
    expect(client.globalEndpoint).toBe('https://glo-xxx.global-cluster.xyz');
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

  it('should call _initGlobalConnection when connect() is called on global client', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(validTopologyResponse),
    }) as any;

    const client = new MilvusClient({
      address: 'https://glo-xxx.global-cluster.xyz',
      token: 'test-token',
      __SKIP_CONNECT__: true,
    });

    // connect() should trigger the global path
    client.connect('test-version');

    // connectPromise should be set (will fail at _getServerInfo, but topology + pool are created)
    try {
      await client.connectPromise;
    } catch {
      // Expected - no real gRPC server
    }

    // Verify global init happened
    expect(client.channelPool).toBeDefined();
    expect(client.globalTopology).toBeTruthy();
    expect(client.config.address).toBe('primary-host:19530');

    // Clean up
    client.topologyRefresher?.stop();
  });

  it('should pass client option values to Connect reserved fields', async () => {
    let capturedConnectRequest: any;
    const client = new MilvusClient({
      address: 'localhost:19530',
      token: 'test-token',
      option: { cluster_id: 'cluster-a' },
      __SKIP_CONNECT__: true,
    });
    client.channelPool = {
      acquire: jest.fn().mockResolvedValue({
        Connect: (request: any, _options: any, callback: Function) => {
          capturedConnectRequest = request;
          callback(null, { identifier: 'client-1', server_info: {} });
        },
      }),
      release: jest.fn(),
    } as any;

    await (client as any)._getServerInfo('test-version');

    expect(capturedConnectRequest.client_info.reserved).toEqual({
      cluster_id: 'cluster-a',
    });
  });

  it('should pass client option values to Connect reserved fields after global init', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(validTopologyResponse),
    }) as any;

    let capturedConnectRequest: any;
    const client = new MilvusClient({
      address: 'https://glo-xxx.global-cluster.xyz',
      token: 'test-token',
      option: { cluster_id: 'cluster-a' },
      __SKIP_CONNECT__: true,
    });
    (client as any).createChannelPool = jest.fn(() => ({
      acquire: jest.fn().mockResolvedValue({
        Connect: (request: any, _options: any, callback: Function) => {
          capturedConnectRequest = request;
          callback(null, { identifier: 'client-1', server_info: {} });
        },
      }),
      release: jest.fn(),
    }));

    await (client as any)._initGlobalConnection('test-version');

    expect(client.config.address).toBe('primary-host:19530');
    expect(capturedConnectRequest.client_info.reserved).toEqual({
      cluster_id: 'cluster-a',
    });
    client.topologyRefresher?.stop();
  });

  it('should reconnect when primary changes', async () => {
    let fetchCount = 0;
    global.fetch = jest.fn().mockImplementation(() => {
      fetchCount++;
      if (fetchCount <= 1) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(validTopologyResponse),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            code: 0,
            data: {
              version: '2',
              clusters: [
                {
                  clusterId: 'c3',
                  endpoint: 'new-primary:19530',
                  capability: 3,
                },
              ],
            },
          }),
      });
    }) as any;

    const client = new MilvusClient({
      address: 'https://glo-xxx.global-cluster.xyz',
      token: 'test-token',
      pool: { min: 0, max: 1 },
      __SKIP_CONNECT__: true,
    });

    const oldPool = {
      drain: jest.fn().mockResolvedValue(undefined),
      clear: jest.fn().mockResolvedValue(undefined),
    } as any;
    const candidatePool = {
      drain: jest.fn().mockResolvedValue(undefined),
      clear: jest.fn().mockResolvedValue(undefined),
    } as any;
    (client as any).createChannelPool = jest
      .fn()
      .mockReturnValueOnce(oldPool)
      .mockReturnValueOnce(candidatePool);
    const oldTelemetryClient = { close: jest.fn() } as any;
    const candidateTelemetryClient = { close: jest.fn() } as any;
    (client as any).createTelemetryClient = jest
      .fn()
      .mockReturnValueOnce(oldTelemetryClient)
      .mockReturnValueOnce(candidateTelemetryClient);
    (client as any)._getServerInfo = jest
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({
        identifier: 'new-client-id',
        server_info: { build_tags: 'new-primary' },
      });

    await (client as any)._initGlobalConnection('test');

    expect(client.config.address).toBe('primary-host:19530');
    expect(client.channelPool).toBe(oldPool);
    const oldRefresher = client.topologyRefresher;
    const telemetry = client.getTelemetry();
    await telemetry.processCommands([
      {
        command_id: 'preserved-state',
        command_type: 'push_config',
        payload: Buffer.from('{"sampling_rate":0.5}'),
        create_time: 1,
        persistent: true,
      },
    ]);
    const oldTelemetryState = {
      config: telemetry.getConfig(),
      configHash: telemetry.configHash,
      lastCommandTimestamp: telemetry.lastCommandTimestamp,
    };

    const changed = await client.reconnectToPrimary();
    expect(changed).toBe(true);
    expect(client.config.address).toBe('new-primary:19530');
    expect(client.channelPool).toBe(candidatePool);
    expect((client as any).telemetryClient).toBe(candidateTelemetryClient);
    expect(client.connectStatus).toBe(CONNECT_STATUS.CONNECTED);
    expect(client.serverInfo).toEqual({ build_tags: 'new-primary' });
    expect(client.topologyRefresher).not.toBe(oldRefresher);
    expect(client.topologyRefresher?.isRunning()).toBe(true);
    expect(oldRefresher?.isRunning()).toBe(false);
    expect(oldTelemetryClient.close).toHaveBeenCalledTimes(1);
    expect(candidateTelemetryClient.close).not.toHaveBeenCalled();
    expect(oldPool.drain).toHaveBeenCalledTimes(1);
    expect(oldPool.clear).toHaveBeenCalledTimes(1);
    expect(candidatePool.drain).not.toHaveBeenCalled();
    expect(telemetry.getConfig()).toEqual(oldTelemetryState.config);
    expect(telemetry.configHash).toBe(oldTelemetryState.configHash);
    expect(telemetry.lastCommandTimestamp).toBe(
      oldTelemetryState.lastCommandTimestamp
    );

    // Clean up
    client.topologyRefresher?.stop();
  });

  it('should return false from reconnectToPrimary when primary unchanged', async () => {
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

    // Reconnect with same topology — primary unchanged
    const changed = await client.reconnectToPrimary();
    expect(changed).toBe(false);

    // Clean up
    client.topologyRefresher?.stop();
  });

  it('should preserve the live lifecycle when candidate validation fails', async () => {
    let fetchCount = 0;
    global.fetch = jest.fn().mockImplementation(() => {
      fetchCount++;
      if (fetchCount <= 1) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(validTopologyResponse),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            code: 0,
            data: {
              version: '2',
              clusters: [
                {
                  clusterId: 'c3',
                  endpoint: 'failing-host:19530',
                  capability: 3,
                },
              ],
            },
          }),
      });
    }) as any;

    const client = new MilvusClient({
      address: 'https://glo-xxx.global-cluster.xyz',
      token: 'test-token',
      pool: { min: 0, max: 1 },
      __SKIP_CONNECT__: true,
    });

    const oldPool = {
      drain: jest.fn().mockResolvedValue(undefined),
      clear: jest.fn().mockResolvedValue(undefined),
    } as any;
    const candidatePool = {
      drain: jest.fn().mockResolvedValue(undefined),
      clear: jest.fn().mockResolvedValue(undefined),
    } as any;
    (client as any).createChannelPool = jest
      .fn()
      .mockReturnValueOnce(oldPool)
      .mockReturnValueOnce(candidatePool);
    const oldTelemetryClient = { close: jest.fn() } as any;
    const candidateTelemetryClient = { close: jest.fn() } as any;
    (client as any).createTelemetryClient = jest
      .fn()
      .mockReturnValueOnce(oldTelemetryClient)
      .mockReturnValueOnce(candidateTelemetryClient);
    (client as any)._getServerInfo = jest
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('connection failed'));

    await (client as any)._initGlobalConnection('test');
    client.connectStatus = CONNECT_STATUS.CONNECTED;
    client.serverInfo = { build_tags: 'old-primary' };
    const oldAddress = client.config.address;
    const oldTopology = client.globalTopology;
    const oldRefresher = client.topologyRefresher;
    const oldEpoch = (client as any).telemetryEndpointEpoch;
    const telemetry = client.getTelemetry();
    await telemetry.processCommands([
      {
        command_id: 'preserved-state',
        command_type: 'push_config',
        payload: Buffer.from('{"sampling_rate":0.5}'),
        create_time: 1,
        persistent: true,
      },
    ]);
    const oldTelemetryState = {
      config: telemetry.getConfig(),
      configHash: telemetry.configHash,
      lastCommandTimestamp: telemetry.lastCommandTimestamp,
    };

    await expect(client.reconnectToPrimary()).rejects.toThrow(
      'connection failed'
    );

    expect(client.config.address).toBe(oldAddress);
    expect(client.channelPool).toBe(oldPool);
    expect((client as any).telemetryClient).toBe(oldTelemetryClient);
    expect((client as any).telemetryEndpointEpoch).toBe(oldEpoch);
    expect(client.globalTopology).toBe(oldTopology);
    expect(client.topologyRefresher).toBe(oldRefresher);
    expect(oldRefresher?.isRunning()).toBe(true);
    expect(client.connectStatus).toBe(CONNECT_STATUS.CONNECTED);
    expect(client.serverInfo).toEqual({ build_tags: 'old-primary' });
    expect(oldTelemetryClient.close).not.toHaveBeenCalled();
    expect(oldPool.drain).not.toHaveBeenCalled();
    expect(oldPool.clear).not.toHaveBeenCalled();
    expect(candidateTelemetryClient.close).toHaveBeenCalledTimes(1);
    expect(candidatePool.drain).toHaveBeenCalledTimes(1);
    expect(candidatePool.clear).toHaveBeenCalledTimes(1);
    expect(telemetry.getConfig()).toEqual(oldTelemetryState.config);
    expect(telemetry.configHash).toBe(oldTelemetryState.configHash);
    expect(telemetry.lastCommandTimestamp).toBe(
      oldTelemetryState.lastCommandTimestamp
    );

    oldRefresher?.stop();
  });

  it('discards and cleans a blocked failover candidate released after close', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          code: 0,
          data: {
            version: '2',
            clusters: [
              {
                clusterId: 'new',
                endpoint: 'new-primary:19530',
                capability: 3,
              },
            ],
          },
        }),
    }) as any;
    const client = new MilvusClient({
      address: 'https://glo-xxx.global-cluster.xyz',
      token: 'test-token',
      pool: { min: 0, max: 1 },
      __SKIP_CONNECT__: true,
    });
    client.config.address = 'old-primary:19530';
    const oldTopology = {
      version: '1',
      clusters: [
        {
          clusterId: 'old',
          endpoint: 'old-primary:19530',
          capability: 3,
        },
      ],
    } as any;
    client.globalTopology = oldTopology;

    const oldPool = {
      drain: jest.fn().mockResolvedValue(undefined),
      clear: jest.fn().mockResolvedValue(undefined),
    } as any;
    const candidatePool = {
      drain: jest.fn().mockResolvedValue(undefined),
      clear: jest.fn().mockResolvedValue(undefined),
    } as any;
    client.channelPool = oldPool;
    (client as any).createChannelPool = jest.fn(() => candidatePool);
    const oldTelemetryClient = { close: jest.fn() } as any;
    const candidateTelemetryClient = { close: jest.fn() } as any;
    (client as any).telemetryClient = oldTelemetryClient;
    (client as any).createTelemetryClient = jest.fn(
      () => candidateTelemetryClient
    );
    let releaseCandidate!: (value: any) => void;
    const candidateValidation = new Promise(resolve => {
      releaseCandidate = resolve;
    });
    (client as any)._getServerInfo = jest.fn(() => candidateValidation);
    const oldEpoch = (client as any).telemetryEndpointEpoch;

    const reconnect = client.reconnectToPrimary();
    while (!(client as any)._getServerInfo.mock.calls.length) {
      await Promise.resolve();
    }
    const concurrentReconnect = client.reconnectToPrimary();
    await client.closeConnection();
    releaseCandidate({
      identifier: 'candidate-client',
      server_info: { build_tags: 'candidate' },
    });

    await expect(reconnect).resolves.toBe(false);
    await expect(concurrentReconnect).resolves.toBe(false);
    expect(client.connectStatus).toBe(CONNECT_STATUS.SHUTDOWN);
    expect(client.config.address).toBe('old-primary:19530');
    expect(client.channelPool).toBe(oldPool);
    expect(client.globalTopology).toBe(oldTopology);
    expect((client as any).telemetryClient).toBeUndefined();
    expect((client as any).telemetryEndpointEpoch).toBe(oldEpoch + 1);
    expect(oldTelemetryClient.close).toHaveBeenCalledTimes(1);
    expect(oldPool.drain).toHaveBeenCalledTimes(1);
    expect(oldPool.clear).toHaveBeenCalledTimes(1);
    expect(candidateTelemetryClient.close).toHaveBeenCalledTimes(1);
    expect(candidatePool.drain).toHaveBeenCalledTimes(1);
    expect(candidatePool.clear).toHaveBeenCalledTimes(1);
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
    let resolveReconnect!: (changed: boolean) => void;
    c.reconnectingPromise = new Promise<boolean>(resolve => {
      resolveReconnect = resolve;
    });

    // Second call should wait for the existing promise, not start a new one
    const waitPromise = client.reconnectToPrimary();
    resolveReconnect(true);
    const result = await waitPromise;

    // Should return true (reconnect was handled by the first caller)
    expect(result).toBe(true);

    // Clean up
    c.isReconnecting = false;
    client.topologyRefresher?.stop();
  });
});
