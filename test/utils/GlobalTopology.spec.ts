import {
  ClusterCapability,
  ClusterInfo,
  GlobalTopology,
  isPrimaryCluster,
  getPrimaryCluster,
  isGlobalEndpoint,
  fetchTopology,
  TopologyRefresher,
} from '../../milvus';

// ============================================================
// 4.1 Unit tests for topology data model
// ============================================================

describe('GlobalTopology data model', () => {
  describe('isGlobalEndpoint', () => {
    it('should detect global-cluster in URI', () => {
      expect(
        isGlobalEndpoint('https://glo-xxx.global-cluster.xyz')
      ).toBe(true);
    });

    it('should be case-insensitive', () => {
      expect(
        isGlobalEndpoint('https://glo-xxx.GLOBAL-CLUSTER.xyz')
      ).toBe(true);
    });

    it('should return false for non-global URIs', () => {
      expect(isGlobalEndpoint('https://in01-xxx.zilliz.com')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isGlobalEndpoint('')).toBe(false);
    });

    it('should return false for undefined-like input', () => {
      expect(isGlobalEndpoint(undefined as any)).toBe(false);
    });
  });

  describe('ClusterCapability', () => {
    it('should have correct bitset values', () => {
      expect(ClusterCapability.READABLE).toBe(0b01);
      expect(ClusterCapability.WRITABLE).toBe(0b10);
      expect(ClusterCapability.PRIMARY).toBe(0b11);
    });
  });

  describe('isPrimaryCluster', () => {
    it('should return true for writable cluster', () => {
      const cluster: ClusterInfo = {
        clusterId: 'c1',
        endpoint: 'host:19530',
        capability: ClusterCapability.PRIMARY,
      };
      expect(isPrimaryCluster(cluster)).toBe(true);
    });

    it('should return true for write-only cluster', () => {
      const cluster: ClusterInfo = {
        clusterId: 'c1',
        endpoint: 'host:19530',
        capability: ClusterCapability.WRITABLE,
      };
      expect(isPrimaryCluster(cluster)).toBe(true);
    });

    it('should return false for read-only cluster', () => {
      const cluster: ClusterInfo = {
        clusterId: 'c1',
        endpoint: 'host:19530',
        capability: ClusterCapability.READABLE,
      };
      expect(isPrimaryCluster(cluster)).toBe(false);
    });

    it('should return false for zero capability', () => {
      const cluster: ClusterInfo = {
        clusterId: 'c1',
        endpoint: 'host:19530',
        capability: 0,
      };
      expect(isPrimaryCluster(cluster)).toBe(false);
    });
  });

  describe('getPrimaryCluster', () => {
    it('should return the primary cluster', () => {
      const topology: GlobalTopology = {
        version: 1,
        clusters: [
          {
            clusterId: 'c1',
            endpoint: 'host1:19530',
            capability: ClusterCapability.READABLE,
          },
          {
            clusterId: 'c2',
            endpoint: 'host2:19530',
            capability: ClusterCapability.PRIMARY,
          },
        ],
      };
      const primary = getPrimaryCluster(topology);
      expect(primary.clusterId).toBe('c2');
      expect(primary.endpoint).toBe('host2:19530');
    });

    it('should throw when no primary cluster exists', () => {
      const topology: GlobalTopology = {
        version: 1,
        clusters: [
          {
            clusterId: 'c1',
            endpoint: 'host1:19530',
            capability: ClusterCapability.READABLE,
          },
        ],
      };
      expect(() => getPrimaryCluster(topology)).toThrow(
        'No primary cluster found in topology'
      );
    });

    it('should throw for empty clusters', () => {
      const topology: GlobalTopology = { version: 1, clusters: [] };
      expect(() => getPrimaryCluster(topology)).toThrow(
        'No primary cluster found in topology'
      );
    });
  });
});

// ============================================================
// 4.2 Unit tests for fetchTopology
// ============================================================

describe('fetchTopology', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const validResponse = {
    code: 0,
    data: {
      version: '3',
      clusters: [
        { clusterId: 'c1', endpoint: 'host1:19530', capability: 3 },
        { clusterId: 'c2', endpoint: 'host2:19530', capability: 1 },
      ],
    },
  };

  it('should fetch and parse topology successfully', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(validResponse),
    }) as any;

    const topology = await fetchTopology(
      'https://glo-xxx.global-cluster.xyz',
      'test-token'
    );

    expect(topology.version).toBe(3);
    expect(topology.clusters).toHaveLength(2);
    expect(topology.clusters[0].clusterId).toBe('c1');

    // Verify the URL and headers
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe(
      'https://glo-xxx.global-cluster.xyz/global-cluster/topology'
    );
    expect(opts.headers.Authorization).toBe('Bearer test-token');
  });

  it('should add https:// if missing', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(validResponse),
    }) as any;

    await fetchTopology('glo-xxx.global-cluster.xyz', 'token');

    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe(
      'https://glo-xxx.global-cluster.xyz/global-cluster/topology'
    );
  });

  it('should strip trailing slashes', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(validResponse),
    }) as any;

    await fetchTopology('https://glo-xxx.global-cluster.xyz/', 'token');

    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe(
      'https://glo-xxx.global-cluster.xyz/global-cluster/topology'
    );
  });

  it('should retry on 5xx HTTP errors', async () => {
    let attempts = 0;
    global.fetch = jest.fn().mockImplementation(() => {
      attempts++;
      if (attempts < 3) {
        return Promise.resolve({
          ok: false,
          status: 503,
          text: () => Promise.resolve('Service Unavailable'),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(validResponse),
      });
    }) as any;

    const topology = await fetchTopology(
      'https://glo-xxx.global-cluster.xyz',
      'token'
    );

    expect(topology.version).toBe(3);
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('should NOT retry on 4xx HTTP errors', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve('Unauthorized'),
    }) as any;

    await expect(
      fetchTopology('https://glo-xxx.global-cluster.xyz', 'bad-token')
    ).rejects.toThrow('Topology request failed with status 401');

    // Should not retry 4xx errors
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should NOT retry on 403 Forbidden', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: () => Promise.resolve('Forbidden'),
    }) as any;

    await expect(
      fetchTopology('https://glo-xxx.global-cluster.xyz', 'token')
    ).rejects.toThrow('Topology request failed with status 403');

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should throw on API error code without retrying', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ code: 1, message: 'Unauthorized' }),
    }) as any;

    await expect(
      fetchTopology('https://glo-xxx.global-cluster.xyz', 'bad-token')
    ).rejects.toThrow('Unauthorized');

    // Should not retry API errors
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should throw after all retries exhausted on 5xx', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Internal Server Error'),
    }) as any;

    await expect(
      fetchTopology('https://glo-xxx.global-cluster.xyz', 'token')
    ).rejects.toThrow('Failed to fetch global topology after 3 attempts');

    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('should retry on network errors', async () => {
    let attempts = 0;
    global.fetch = jest.fn().mockImplementation(() => {
      attempts++;
      if (attempts < 3) {
        return Promise.reject(new Error('fetch failed'));
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(validResponse),
      });
    }) as any;

    const topology = await fetchTopology(
      'https://glo-xxx.global-cluster.xyz',
      'token'
    );

    expect(topology.version).toBe(3);
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });
});

// ============================================================
// 4.3 Unit tests for TopologyRefresher
// ============================================================

describe('TopologyRefresher', () => {
  const originalFetch = global.fetch;

  // Helper to flush microtasks (Promise callbacks)
  const flushPromises = () =>
    new Promise<void>(resolve => setImmediate(resolve));

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const initialTopology: GlobalTopology = {
    version: 1,
    clusters: [
      { clusterId: 'c1', endpoint: 'host1:19530', capability: 3 },
    ],
  };

  it('should start and stop', () => {
    const refresher = new TopologyRefresher({
      globalEndpoint: 'https://glo-xxx.global-cluster.xyz',
      token: 'token',
      topology: initialTopology,
    });

    expect(refresher.isRunning()).toBe(false);
    refresher.start();
    expect(refresher.isRunning()).toBe(true);
    refresher.stop();
    expect(refresher.isRunning()).toBe(false);
  });

  it('should not double-start', () => {
    const refresher = new TopologyRefresher({
      globalEndpoint: 'https://glo-xxx.global-cluster.xyz',
      token: 'token',
      topology: initialTopology,
    });

    refresher.start();
    refresher.start(); // should be a no-op
    expect(refresher.isRunning()).toBe(true);
    refresher.stop();
  });

  it('should return initial topology', () => {
    const refresher = new TopologyRefresher({
      globalEndpoint: 'https://glo-xxx.global-cluster.xyz',
      token: 'token',
      topology: initialTopology,
    });

    expect(refresher.getTopology()).toEqual(initialTopology);
  });

  it('should update topology on higher version', async () => {
    const newTopology = {
      version: 2,
      clusters: [
        { clusterId: 'c2', endpoint: 'host2:19530', capability: 3 },
      ],
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ code: 0, data: { ...newTopology, version: '2' } }),
    }) as any;

    const onChange = jest.fn();
    const refresher = new TopologyRefresher({
      globalEndpoint: 'https://glo-xxx.global-cluster.xyz',
      token: 'token',
      topology: initialTopology,
      refreshInterval: 100,
      onTopologyChange: onChange,
    });

    refresher.start();

    // Wait for the interval to fire and the async refresh to complete
    await new Promise(resolve => setTimeout(resolve, 200));
    await flushPromises();

    expect(refresher.getTopology().version).toBe(2);
    expect(onChange).toHaveBeenCalledWith(newTopology);

    refresher.stop();
  });

  it('should not update topology on same version', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          code: 0,
          data: { version: '1', clusters: initialTopology.clusters },
        }),
    }) as any;

    const onChange = jest.fn();
    const refresher = new TopologyRefresher({
      globalEndpoint: 'https://glo-xxx.global-cluster.xyz',
      token: 'token',
      topology: initialTopology,
      refreshInterval: 100,
      onTopologyChange: onChange,
    });

    refresher.start();
    await new Promise(resolve => setTimeout(resolve, 200));
    await flushPromises();

    expect(onChange).not.toHaveBeenCalled();
    refresher.stop();
  });

  it('should survive refresh failure', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network error')) as any;

    const refresher = new TopologyRefresher({
      globalEndpoint: 'https://glo-xxx.global-cluster.xyz',
      token: 'token',
      topology: initialTopology,
      refreshInterval: 100,
    });

    refresher.start();
    await new Promise(resolve => setTimeout(resolve, 200));
    await flushPromises();

    // Should still have the old topology
    expect(refresher.getTopology()).toEqual(initialTopology);
    expect(refresher.isRunning()).toBe(true);
    refresher.stop();
  });

  it('should debounce triggerRefresh', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          code: 0,
          data: { version: '1', clusters: initialTopology.clusters },
        }),
    }) as any;

    const refresher = new TopologyRefresher({
      globalEndpoint: 'https://glo-xxx.global-cluster.xyz',
      token: 'token',
      topology: initialTopology,
    });

    // Trigger multiple refreshes rapidly
    refresher.triggerRefresh();
    refresher.triggerRefresh(); // should be debounced
    refresher.triggerRefresh(); // should be debounced

    // Wait for the async refresh to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    await flushPromises();

    // Only one fetch should have been made (debounced)
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should clear interval on stop', async () => {
    const refresher = new TopologyRefresher({
      globalEndpoint: 'https://glo-xxx.global-cluster.xyz',
      token: 'token',
      topology: initialTopology,
      refreshInterval: 100,
    });

    refresher.start();
    refresher.stop();

    // Advance time - no refresh should happen
    global.fetch = jest.fn() as any;
    await new Promise(resolve => setTimeout(resolve, 300));

    expect(global.fetch).not.toHaveBeenCalled();
  });
});
