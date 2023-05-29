import {
  MilvusClient,
  DataType,
  ErrorCode,
  ERROR_REASONS,
  DEFAULT_PARTITIONS_NUMBER,
} from '../milvus';
import {
  IP,
  genCollectionParams,
  GENERATE_NAME,
  generateInsertData,
} from './tools';

const milvusClient = new MilvusClient({ address: IP, debug: false });
const COLLECTION_NAME = GENERATE_NAME();
const COLLECTION_NAME2 = GENERATE_NAME();
const COLLECTION_DATA_NAME = GENERATE_NAME();
const numPartitions = 3;
const dbParam = {
  db_name: 'PartitionKey',
};

describe(`Partition key API`, () => {
  beforeAll(async () => {
    await milvusClient.createDatabase(dbParam);
    await milvusClient.use(dbParam);
    // create
    const createCollectionParams = genCollectionParams({
      collectionName: COLLECTION_DATA_NAME,
      dim: 4,
      vectorType: DataType.FloatVector,
      autoID: false,
      partitionKeyEnabled: true,
      numPartitions,
    });
    await milvusClient.createCollection(createCollectionParams);

    try {
      const data = generateInsertData(createCollectionParams.fields, 20);
      await milvusClient.insert({
        collection_name: COLLECTION_DATA_NAME,
        fields_data: data,
      });

      // create index
      await milvusClient.createIndex({
        collection_name: COLLECTION_DATA_NAME,
        index_name: 't',
        field_name: 'vector',
        index_type: 'IVF_FLAT',
        metric_type: 'L2',
        params: { nlist: 1024 },
      });
      // load
      await milvusClient.loadCollectionSync({
        collection_name: COLLECTION_DATA_NAME,
      });
    } catch (e) {
      console.log(e);
    }
  });

  afterAll(async () => {
    await milvusClient.dropCollection({
      collection_name: COLLECTION_NAME,
    });
    await milvusClient.dropCollection({
      collection_name: COLLECTION_NAME2,
    });
    await milvusClient.dropCollection({
      collection_name: COLLECTION_DATA_NAME,
    });
    await milvusClient.dropDatabase(dbParam);
  });

  it(`Create Collection with 2 partition key fields should throw error`, async () => {
    const createCollectionParams = genCollectionParams({
      collectionName: COLLECTION_NAME,
      dim: 4,
      vectorType: DataType.FloatVector,
      autoID: false,
      partitionKeyEnabled: true,
      numPartitions,
      fields: [
        {
          name: 'name2',
          description: 'VarChar field',
          data_type: DataType.VarChar,
          max_length: 128,
          is_partition_key: true,
        },
      ],
    });

    try {
      await milvusClient.createCollection(createCollectionParams);
    } catch (error) {
      expect(error.message).toEqual(
        ERROR_REASONS.PARTITION_KEY_FIELD_MAXED_OUT
      );
    }
  });

  it(`Create Collection should be successful with numPartitions`, async () => {
    const createCollectionParams = genCollectionParams({
      collectionName: COLLECTION_NAME,
      dim: 4,
      vectorType: DataType.FloatVector,
      autoID: false,
      partitionKeyEnabled: true,
      numPartitions,
    });

    const res = await milvusClient.createCollection(createCollectionParams);
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Create Collection should be successful without numPartitions`, async () => {
    const createCollectionParams = genCollectionParams({
      collectionName: COLLECTION_NAME2,
      dim: 4,
      vectorType: DataType.FloatVector,
      autoID: false,
      partitionKeyEnabled: true,
    });
    const res = await milvusClient.createCollection(createCollectionParams);
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`it should throw error when creating a partition on a partition-key enabled collection`, async () => {
    const res = await milvusClient.createPartition({
      collection_name: COLLECTION_NAME,
      partition_name: 'p',
    });

    expect(res.error_code).toEqual(ErrorCode.UNEXPECTED_ERROR);
  });

  it(`Describe Collection should be successful`, async () => {
    const res = await milvusClient.describeCollection({
      collection_name: COLLECTION_NAME,
    });

    expect(Number(res.num_partitions)).toEqual(3);

    const res2 = await milvusClient.describeCollection({
      collection_name: COLLECTION_NAME2,
    });

    expect(Number(res2.num_partitions)).toEqual(DEFAULT_PARTITIONS_NUMBER);
  });

  it(`Query Collection should be successful`, async () => {
    const res = await milvusClient.query({
      collection_name: COLLECTION_DATA_NAME,
      expr: 'name in ["apple"]',
      output_fields: ['name'],
    });

    expect(res.data.some(data => data.name === 'apple')).toEqual(true);
  });

  it(`Query Collection with partition specified should get error`, async () => {
    const res = await milvusClient.query({
      collection_name: COLLECTION_DATA_NAME,
      partition_names: ['p'],
      expr: 'name in ["apple"]',
      output_fields: ['name'],
    });

    expect(res.status.error_code).toEqual(ErrorCode.UNEXPECTED_ERROR);
  });

  it(`Search Collection should be successful`, async () => {
    const res = await milvusClient.search({
      collection_name: COLLECTION_DATA_NAME,
      vector: [1, 2, 3, 4],
      expr: 'name in ["apple"]',
      output_fields: ['name'],
    });

    expect(res.results.some(data => data.name === 'apple')).toEqual(true);
  });

  it(`Search Collection with partition specified should get error`, async () => {
    const search = await milvusClient.search({
      collection_name: COLLECTION_DATA_NAME,
      partition_names: ['p'],
      vector: [1, 2, 3, 4],
      expr: 'name in ["apple"]',
      output_fields: ['name'],
    });

    expect(search.status.error_code).toEqual(ErrorCode.UNEXPECTED_ERROR);
  });
});
