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

describe(`Dynamic schema API`, () => {
  beforeAll(async () => {
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
});
