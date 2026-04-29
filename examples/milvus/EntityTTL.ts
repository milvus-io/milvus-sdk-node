import {
  CollectionProperties,
  DataType,
  IndexType,
  MetricType,
  MilvusClient,
} from '@zilliz/milvus2-sdk-node';

const COLLECTION_NAME = 'entity_ttl_demo';
const VECTOR_DIM = 4;

(async () => {
  const milvusClient = new MilvusClient({
    address: 'localhost:19530',
    username: 'username',
    password: 'Aa12345!!',
  });

  await milvusClient.dropCollection({
    collection_name: COLLECTION_NAME,
  });

  await milvusClient.createCollection({
    collection_name: COLLECTION_NAME,
    fields: [
      {
        name: 'id',
        data_type: DataType.Int64,
        is_primary_key: true,
        autoID: false,
      },
      {
        name: 'ttl',
        data_type: DataType.Timestamptz,
        nullable: true,
      },
      {
        name: 'vector',
        data_type: DataType.FloatVector,
        dim: VECTOR_DIM,
      },
    ],
    // Entity-level TTL: Milvus treats this Timestamptz field as ExpireAt.
    // It is mutually exclusive with collection-level TTL
    // (`collection.ttl.seconds`).
    properties: {
      [CollectionProperties.TTL_FIELD]: 'ttl',
    },
  });

  await milvusClient.insert({
    collection_name: COLLECTION_NAME,
    data: [
      {
        id: 1,
        ttl: null, // never expires
        vector: [0.1, 0.2, 0.3, 0.4],
      },
      {
        id: 2,
        ttl: '2099-12-31T00:00:00Z', // expires at this absolute time
        vector: [0.2, 0.3, 0.4, 0.5],
      },
      {
        id: 3,
        ttl: '2000-01-01T00:00:00Z', // already expired
        vector: [0.3, 0.4, 0.5, 0.6],
      },
    ],
  });

  await milvusClient.flushSync({
    collection_names: [COLLECTION_NAME],
  });

  await milvusClient.createIndex({
    collection_name: COLLECTION_NAME,
    field_name: 'vector',
    index_type: IndexType.AUTOINDEX,
    metric_type: MetricType.L2,
  });

  await milvusClient.loadCollectionSync({
    collection_name: COLLECTION_NAME,
  });

  const query = await milvusClient.query({
    collection_name: COLLECTION_NAME,
    filter: 'id >= 1',
    output_fields: ['id', 'ttl'],
    limit: 10,
  });

  console.log('Query result excludes expired entities:', query.data);

  const search = await milvusClient.search({
    collection_name: COLLECTION_NAME,
    data: [0.1, 0.2, 0.3, 0.4],
    output_fields: ['id', 'ttl'],
    limit: 10,
  });

  console.log('Search result excludes expired entities:', search.results);

  // Upgrade an old collection dynamically:
  // 1. Drop collection-level TTL first, if set.
  // await milvusClient.dropCollectionProperties({
  //   collection_name: COLLECTION_NAME,
  //   properties: [CollectionProperties.TTL_SECONDS],
  // });
  // 2. Add a Timestamptz field.
  // await milvusClient.addCollectionField({
  //   collection_name: COLLECTION_NAME,
  //   field: { name: 'ttl', data_type: DataType.Timestamptz, nullable: true },
  // });
  // 3. Mark it as the TTL field.
  // await milvusClient.alterCollectionProperties({
  //   collection_name: COLLECTION_NAME,
  //   properties: { [CollectionProperties.TTL_FIELD]: 'ttl' },
  // });

  await milvusClient.dropCollection({
    collection_name: COLLECTION_NAME,
  });
})();
