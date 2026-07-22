import {
  MilvusClient,
  DataType,
  FunctionType,
  ErrorCode,
  MetricType,
  ConsistencyLevelEnum,
} from '../../milvus';
import { IP, GENERATE_NAME } from '../tools';

let milvusClient: MilvusClient;
const COLLECTION = GENERATE_NAME();
const dbParam = {
  db_name: 'TextEmbedding',
};
const hasOpenAICredentials =
  process.env.MILVUS_OPENAI_ENABLED === '1' ||
  Boolean(process.env.MILVUS_OPENAI_API_KEY);
const describeIfOpenAIConfigured = hasOpenAICredentials
  ? describe
  : describe.skip;

describeIfOpenAIConfigured(`Text Embedding Function API`, () => {
  beforeAll(async () => {
    milvusClient = new MilvusClient({ address: IP, logLevel: 'info' });
    await milvusClient.createDatabase(dbParam);
    await milvusClient.use(dbParam);
  });
  afterAll(async () => {
    await milvusClient.dropCollection({
      collection_name: COLLECTION,
    });
    await milvusClient.dropDatabase(dbParam);
  });

  it(`Create collection with text embedding function should success`, async () => {
    const create = await milvusClient.createCollection({
      collection_name: COLLECTION,
      consistency_level: 'Strong',
      fields: [
        {
          name: 'id',
          data_type: DataType.Int64,
          is_primary_key: true,
          autoID: false,
        },
        {
          name: 'text',
          data_type: DataType.VarChar,
          max_length: 512,
          enable_analyzer: true,
        },
        {
          name: 'dense',
          data_type: DataType.FloatVector,
          dim: 1536,
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
          },
        },
      ],
    });
    expect(create.error_code).toEqual(ErrorCode.SUCCESS);

    const describe = await milvusClient.describeCollection({
      collection_name: COLLECTION,
    });
    const denseField = describe.schema.fields.find(f => f.name === 'dense');
    expect(denseField!.is_function_output).toEqual(true);

    const func = describe.schema.functions.find(f => f.name === 'openai');
    expect(func).toBeDefined();
    expect(func!.input_field_names).toEqual(['text']);
    expect(func!.output_field_names).toEqual(['dense']);
    expect(func!.type).toEqual('TextEmbedding');
  });

  it(`Alter text embedding function should success`, async () => {
    const alter = await milvusClient.alterCollectionFunction({
      collection_name: COLLECTION,
      function_name: 'openai',
      function: {
        name: 'openai',
        description: 'openai text embedding function altered via API',
        type: FunctionType.TEXTEMBEDDING,
        input_field_names: ['text'],
        output_field_names: ['dense'],
        params: {
          provider: 'openai',
          model_name: 'text-embedding-3-small',
        },
      },
    });
    expect(alter.error_code).toEqual(ErrorCode.SUCCESS);

    const describe = await milvusClient.describeCollection({
      collection_name: COLLECTION,
      cache: false,
    });
    const func = describe.schema.functions.find(f => f.name === 'openai');
    expect(func).toBeDefined();
    expect(func!.description).toEqual(
      'openai text embedding function altered via API'
    );
  });

  it(`Insert text data should success`, async () => {
    const insert = await milvusClient.insert({
      collection_name: COLLECTION,
      data: [
        { id: 1, text: 'apple is a fruit' },
        { id: 2, text: 'banana is yellow' },
        { id: 3, text: 'orange juice is delicious' },
        { id: 4, text: 'machine learning is interesting' },
        { id: 5, text: 'vector database is fast' },
      ],
    });

    expect(insert.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Create index and load collection should success`, async () => {
    const createIndex = await milvusClient.createIndex({
      collection_name: COLLECTION,
      field_name: 'dense',
      index_type: 'HNSW',
      metric_type: MetricType.COSINE,
      params: { M: 4, efConstruction: 8 },
    });
    expect(createIndex.error_code).toEqual(ErrorCode.SUCCESS);

    const load = await milvusClient.loadCollection({
      collection_name: COLLECTION,
    });
    expect(load.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Search with text on FloatVector function output should success`, async () => {
    const search = await milvusClient.search({
      collection_name: COLLECTION,
      data: 'fruit',
      anns_field: 'dense',
      limit: 3,
      output_fields: ['text'],
      consistency_level: ConsistencyLevelEnum.Strong,
    });

    expect(search.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(search.results.length).toBeGreaterThan(0);
  });

  it(`Search with multiple texts on FloatVector function output should success`, async () => {
    const search = await milvusClient.search({
      collection_name: COLLECTION,
      data: ['fruit', 'technology'],
      anns_field: 'dense',
      limit: 3,
      output_fields: ['text'],
      consistency_level: ConsistencyLevelEnum.Strong,
    });

    expect(search.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(search.results.length).toBeGreaterThan(0);
  });
});
