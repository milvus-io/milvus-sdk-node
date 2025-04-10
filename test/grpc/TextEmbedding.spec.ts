import { MilvusClient, DataType, FunctionType, ErrorCode } from '../../milvus';
import { IP, genCollectionParams, GENERATE_NAME } from '../tools';

const milvusClient = new MilvusClient({ address: IP, logLevel: 'info' });
const COLLECTION = GENERATE_NAME();
const dbParam = {
  db_name: 'FullTextSearch',
};
const numPartitions = 3;

// create
const createCollectionParams = genCollectionParams({
  collectionName: COLLECTION,
  dim: [4],
  vectorType: [DataType.FloatVector],
  autoID: false,
  partitionKeyEnabled: true,
  numPartitions,
  enableDynamic: true,
  fields: [
    {
      name: 'text',
      description: 'text field',
      data_type: DataType.VarChar,
      max_length: 20,
      is_partition_key: false,
      enable_analyzer: true,
    },
    {
      name: 'dense',
      description: 'dense field',
      dim: 4,
      data_type: DataType.FloatVector,
      is_function_output: true,
    },
  ],
  functions: [
    {
      name: 'openai',
      description: 'openai text embedding function',
      type: FunctionType.TEXTEMBEDDING,
      input_field_names: ['text'],
      output_field_names: ['dense'],
      params: {
        provider: 'openai',
        model_name: 'text-embedding-3-small',
        api_key: 'yourkey',
      },
    },
  ],
});

describe(`Text Embedding Function API`, () => {
  beforeAll(async () => {
    // create db and use db
    await milvusClient.createDatabase(dbParam);
    await milvusClient.use(dbParam);
  });
  afterAll(async () => {
    await milvusClient.dropCollection({
      collection_name: COLLECTION,
    });
    await milvusClient.dropDatabase(dbParam);
  });

  it(`Create schema with function collection should success`, async () => {
    try {
      await milvusClient.createCollection(createCollectionParams);
    } catch (error) {
      expect(error.error_code).toBe(ErrorCode.UnexpectedError);
    }
  });
});
