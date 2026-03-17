import {
  MilvusClient,
  DataType,
  ErrorCode,
  fetchTopology,
  getPrimaryCluster,
  isPrimaryCluster,
} from '../../milvus';

// Set via environment variables:
//   GLOBAL_CLUSTER_ENDPOINT=https://glo-xxx.global-cluster.xyz
//   GLOBAL_CLUSTER_TOKEN=your_token
const GLOBAL_ENDPOINT = process.env.GLOBAL_CLUSTER_ENDPOINT || '';
const TOKEN = process.env.GLOBAL_CLUSTER_TOKEN || '';

const COLLECTION_NAME = `test_global_cluster_${Date.now()}`;
const DIM = 4;

// Will be resolved from topology
let SECONDARY_ENDPOINT = '';

// Skip all tests if env vars not set
const describeIfConfigured = GLOBAL_ENDPOINT && TOKEN ? describe : describe.skip;

describeIfConfigured('Global Cluster E2E', () => {
  let client: MilvusClient;

  it('should fetch topology and find primary', async () => {
    const topology = await fetchTopology(GLOBAL_ENDPOINT, TOKEN);

    expect(topology.version).toBeGreaterThan(0);
    expect(topology.clusters.length).toBeGreaterThanOrEqual(1);

    const primary = getPrimaryCluster(topology);
    expect(primary.endpoint).toBeTruthy();
    expect(primary.capability & 0b10).toBe(0b10); // writable

    // Capture secondary endpoint for later tests
    const secondary = topology.clusters.find(c => !isPrimaryCluster(c));
    if (secondary) {
      SECONDARY_ENDPOINT = secondary.endpoint;
    }

    console.log(
      `Topology v${topology.version}: ${topology.clusters.length} clusters, primary=${primary.endpoint}, secondary=${SECONDARY_ENDPOINT}`
    );
  });

  it('should connect via global endpoint', async () => {
    client = new MilvusClient({
      address: GLOBAL_ENDPOINT,
      token: TOKEN,
    });

    // Wait for connection
    await client.connectPromise;

    expect(client.isGlobal).toBe(true);
    expect(client.globalTopology).toBeTruthy();
    expect(client.topologyRefresher).toBeTruthy();
    expect(client.topologyRefresher!.isRunning()).toBe(true);

    // config.address should be resolved to primary endpoint
    expect(client.config.address).toContain('vectordb-uat3.zillizcloud.com');
    expect(client.config.address).not.toContain('global-cluster');

    console.log(`Connected to primary: ${client.config.address}`);
  });

  it('should get server version', async () => {
    const version = await client.getVersion();
    expect(version.version).toBeTruthy();
    console.log(`Server version: ${version.version}`);
  });

  it('should check health', async () => {
    const health = await client.checkHealth();
    expect(health.isHealthy).toBe(true);
  });

  it('should create collection', async () => {
    const res = await client.createCollection({
      collection_name: COLLECTION_NAME,
      fields: [
        {
          name: 'id',
          data_type: DataType.Int64,
          is_primary_key: true,
          autoID: true,
        },
        {
          name: 'vector',
          data_type: DataType.FloatVector,
          dim: DIM,
        },
        {
          name: 'text',
          data_type: DataType.VarChar,
          max_length: 128,
        },
      ],
    });

    expect(res.error_code).toBe(ErrorCode.SUCCESS);
  });

  it('should insert data', async () => {
    const res = await client.insert({
      collection_name: COLLECTION_NAME,
      data: [
        { vector: [0.1, 0.2, 0.3, 0.4], text: 'hello' },
        { vector: [0.5, 0.6, 0.7, 0.8], text: 'world' },
        { vector: [0.9, 0.1, 0.2, 0.3], text: 'global' },
      ],
    });

    expect(res.status.error_code).toBe(ErrorCode.SUCCESS);
    expect(res.succ_index.length).toBe(3);
  });

  it('should create index and load collection', async () => {
    const indexRes = await client.createIndex({
      collection_name: COLLECTION_NAME,
      field_name: 'vector',
      index_type: 'AUTOINDEX',
      metric_type: 'COSINE',
    });
    expect(indexRes.error_code).toBe(ErrorCode.SUCCESS);

    const loadRes = await client.loadCollectionSync({
      collection_name: COLLECTION_NAME,
    });
    expect(loadRes.error_code).toBe(ErrorCode.SUCCESS);
  }, 60000);

  it('should search data', async () => {
    const res = await client.search({
      collection_name: COLLECTION_NAME,
      data: [0.1, 0.2, 0.3, 0.4],
      limit: 3,
    });

    expect(res.status.error_code).toBe(ErrorCode.SUCCESS);
    expect(res.results.length).toBeGreaterThan(0);
    console.log(`Search returned ${res.results.length} results`);
  });

  it('should query data', async () => {
    const res = await client.query({
      collection_name: COLLECTION_NAME,
      filter: 'text == "hello"',
      output_fields: ['text', 'vector'],
    });

    expect(res.status.error_code).toBe(ErrorCode.SUCCESS);
    expect(res.data.length).toBe(1);
    expect(res.data[0].text).toBe('hello');
  });

  afterAll(async () => {
    if (client) {
      // Don't drop collection yet — secondary tests need it
      await client.closeConnection();
    }
  });
});

describeIfConfigured('Secondary Cluster - Read Only', () => {
  let secondaryClient: MilvusClient;
  let primaryClient: MilvusClient;

  beforeAll(async () => {
    if (!SECONDARY_ENDPOINT) {
      console.warn('No secondary cluster found, skipping secondary tests');
      return;
    }

    // Connect directly to secondary (bypass global routing)
    secondaryClient = new MilvusClient({
      address: SECONDARY_ENDPOINT,
      token: TOKEN,
      isGlobal: false, // direct connection, not global
    });
    await secondaryClient.connectPromise;
    console.log(`Connected to secondary: ${SECONDARY_ENDPOINT}`);
  });

  // --- Read operations should succeed on secondary ---

  it('should list collections on secondary', async () => {
    if (!secondaryClient) return;

    const res = await secondaryClient.listCollections();
    expect(res.status.error_code).toBe(ErrorCode.SUCCESS);
    // The collection created by primary should be visible
    const names = res.data.map((c: any) => c.name);
    expect(names).toContain(COLLECTION_NAME);
    console.log(
      `Secondary sees ${res.data.length} collections, includes test collection: ${names.includes(COLLECTION_NAME)}`
    );
  });

  it('should describe collection on secondary', async () => {
    if (!secondaryClient) return;

    const res = await secondaryClient.describeCollection({
      collection_name: COLLECTION_NAME,
    });
    expect(res.status.error_code).toBe(ErrorCode.SUCCESS);
    expect(res.schema.fields.length).toBeGreaterThan(0);
  });

  it('should search on secondary (read)', async () => {
    if (!secondaryClient) return;

    const res = await secondaryClient.search({
      collection_name: COLLECTION_NAME,
      data: [0.1, 0.2, 0.3, 0.4],
      limit: 3,
    });

    expect(res.status.error_code).toBe(ErrorCode.SUCCESS);
    expect(res.results.length).toBeGreaterThan(0);
    console.log(
      `Secondary search returned ${res.results.length} results`
    );
  });

  it('should query on secondary (read)', async () => {
    if (!secondaryClient) return;

    const res = await secondaryClient.query({
      collection_name: COLLECTION_NAME,
      filter: 'text == "hello"',
      output_fields: ['text'],
    });

    expect(res.status.error_code).toBe(ErrorCode.SUCCESS);
    expect(res.data.length).toBe(1);
    expect(res.data[0].text).toBe('hello');
  });

  it('should get server version on secondary', async () => {
    if (!secondaryClient) return;

    const version = await secondaryClient.getVersion();
    expect(version.version).toBeTruthy();
  });

  // --- Write operations should be rejected on secondary ---

  it('should reject insert on secondary (write denied)', async () => {
    if (!secondaryClient) return;

    const res = await secondaryClient.insert({
      collection_name: COLLECTION_NAME,
      data: [{ vector: [0.1, 0.2, 0.3, 0.4], text: 'should_fail' }],
    });

    // Expect a non-SUCCESS error code
    expect(res.status.error_code).not.toBe(ErrorCode.SUCCESS);
    console.log(
      `Secondary insert rejected: ${res.status.error_code} - ${res.status.reason}`
    );
  });

  it('should reject upsert on secondary (write denied)', async () => {
    if (!secondaryClient) return;

    const res = await secondaryClient.upsert({
      collection_name: COLLECTION_NAME,
      data: [{ vector: [0.1, 0.2, 0.3, 0.4], text: 'should_fail' }],
    });

    expect(res.status.error_code).not.toBe(ErrorCode.SUCCESS);
    console.log(
      `Secondary upsert rejected: ${res.status.error_code} - ${res.status.reason}`
    );
  });

  it('should reject delete on secondary (write denied)', async () => {
    if (!secondaryClient) return;

    const res = await secondaryClient.deleteEntities({
      collection_name: COLLECTION_NAME,
      filter: 'text == "hello"',
    });

    expect(res.status.error_code).not.toBe(ErrorCode.SUCCESS);
    console.log(
      `Secondary delete rejected: ${res.status.error_code} - ${res.status.reason}`
    );
  });

  it('should reject createCollection on secondary (write denied)', async () => {
    if (!secondaryClient) return;

    const tempName = `test_secondary_write_${Date.now()}`;
    try {
      const res = await secondaryClient.createCollection({
        collection_name: tempName,
        fields: [
          {
            name: 'id',
            data_type: DataType.Int64,
            is_primary_key: true,
            autoID: true,
          },
          {
            name: 'vector',
            data_type: DataType.FloatVector,
            dim: DIM,
          },
        ],
      });

      // If it returns instead of throwing, expect error
      expect(res.error_code).not.toBe(ErrorCode.SUCCESS);
      console.log(
        `Secondary createCollection rejected: ${res.error_code} - ${res.reason}`
      );
    } catch (e: any) {
      // Some DDL operations throw instead of returning error
      expect(e.reason || e.detail || e.message).toContain(
        'cluster is not primary'
      );
      console.log(
        `Secondary createCollection threw: ${e.reason || e.detail || e.message}`
      );
    }
  });

  it('should reject dropCollection on secondary (write denied)', async () => {
    if (!secondaryClient) return;

    const res = await secondaryClient.dropCollection({
      collection_name: COLLECTION_NAME,
    });

    expect(res.error_code).not.toBe(ErrorCode.SUCCESS);
    console.log(
      `Secondary dropCollection rejected: ${res.error_code} - ${res.reason}`
    );
  });

  it('should reject createIndex on secondary (write denied)', async () => {
    if (!secondaryClient) return;

    const res = await secondaryClient.createIndex({
      collection_name: COLLECTION_NAME,
      field_name: 'vector',
      index_type: 'AUTOINDEX',
      metric_type: 'COSINE',
    });

    expect(res.error_code).not.toBe(ErrorCode.SUCCESS);
    console.log(
      `Secondary createIndex rejected: ${res.error_code} - ${res.reason}`
    );
  });

  afterAll(async () => {
    // To keep collection data for inspection, set KEEP_COLLECTION=1
    // e.g.: KEEP_COLLECTION=1 NODE_ENV=dev npx jest test/grpc/GlobalCluster.spec.ts --forceExit
    if (!process.env.KEEP_COLLECTION) {
      primaryClient = new MilvusClient({
        address: GLOBAL_ENDPOINT,
        token: TOKEN,
      });
      await primaryClient.connectPromise;

      try {
        await primaryClient.dropCollection({
          collection_name: COLLECTION_NAME,
        });
      } catch {
        // ignore
      }

      await primaryClient.closeConnection();
    }
    if (secondaryClient) {
      await secondaryClient.closeConnection();
    }
  });
});
