import {
  MilvusClient,
  DataType,
  ErrorCode,
  MetricType,
  ConsistencyLevelEnum,
  FunctionType,
} from '../../milvus';
import {
  IP,
  genCollectionParams,
  GENERATE_NAME,
  generateInsertData,
  dynamicFields,
} from '../tools';

const milvusClient = new MilvusClient({ address: IP, logLevel: 'debug' });
const COLLECTION = GENERATE_NAME();
const dbParam = {
  db_name: 'FullTextSearch',
};
const numPartitions = 3;

// create
const createCollectionParams = genCollectionParams({
  collectionName: COLLECTION,
  dim: [4],
  vectorType: [DataType.SparseFloatVector],
  autoID: false,
  partitionKeyEnabled: true,
  numPartitions,
  enableDynamic: true,
  fields: [
    {
      name: 'text',
      description: 'text field',
      data_type: DataType.VarChar,
      max_length: 200,
      is_partition_key: false,
      enable_tokenizer: true,
      enable_match: true,
      analyzer_params: { tokenizer: 'jieba' },
    },
  ],
  functions: [
    {
      name: 'bm25f1',
      description: 'bm25 function',
      type: FunctionType.BM25,
      input_field_names: ['text'],
      output_field_names: ['vector'],
      params: {},
    },
  ],
});

describe(`Full text search API`, () => {
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
    const create = await milvusClient.createCollection(createCollectionParams);

    expect(create.error_code).toEqual(ErrorCode.SUCCESS);

    // describe
    const describe = await milvusClient.describeCollection({
      collection_name: COLLECTION,
    });
    // expect the 'vector' field to be created
    expect(describe.schema.fields.length).toEqual(
      createCollectionParams.fields.length
    );
    // extract the 'vector' field
    const vector = describe.schema.fields.find(
      field => field.is_function_output
    );
    // expect the 'vector' field's name to be 'vector'
    expect(vector!.name).toEqual('vector');

    // expect functions are in the schema
    expect(describe.schema.functions.length).toEqual(1);
    expect(describe.schema.functions[0].name).toEqual('bm25f1');
    expect(describe.schema.functions[0].input_field_names).toEqual(['text']);
    expect(describe.schema.functions[0].output_field_names).toEqual(['vector']);
    expect(describe.schema.functions[0].type).toEqual('BM25');
  });

  it(`Insert data with function field should success`, async () => {
    const data = generateInsertData(
      [...createCollectionParams.fields, ...dynamicFields],
      10
    );

    const insert = await milvusClient.insert({
      collection_name: COLLECTION,
      fields_data: data,
    });

    expect(insert.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Create index on function output field should success`, async () => {
    const createIndex = await milvusClient.createIndex({
      collection_name: COLLECTION,
      index_name: 't2',
      field_name: 'vector',
      index_type: 'SPARSE_INVERTED_INDEX',
      metric_type: MetricType.BM25,
      params: { bm25_k1: 1.25, bm25_b: 0.75 }, //drop_ratio_build: 0.3,
    });

    expect(createIndex.error_code).toEqual(ErrorCode.SUCCESS);

    // load
    const load = await milvusClient.loadCollection({
      collection_name: COLLECTION,
    });

    expect(load.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`query with function output field should success`, async () => {
    // query
    const query = await milvusClient.query({
      collection_name: COLLECTION,
      limit: 10,
      expr: 'id > 0',
      output_fields: ['vector', 'id', 'text'],
      consistency_level: ConsistencyLevelEnum.Strong,
    });

    expect(query.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(query.data.length).toEqual(10);
    // data should have 'sparse' field
    expect(query.data[0].hasOwnProperty('vector')).toBeTruthy();
  });

  it(`search with text should success`, async () => {
    // search nq = 1
    const search = await milvusClient.search({
      collection_name: COLLECTION,
      limit: 10,
      data: 'apple',
      anns_field: 'vector',
      output_fields: ['*'],
      params: { drop_ratio_search: 0.6 },
      consistency_level: ConsistencyLevelEnum.Strong,
    });

    expect(search.status.error_code).toEqual(ErrorCode.SUCCESS);

    // nq > 1
    const search2 = await milvusClient.search({
      collection_name: COLLECTION,
      limit: 10,
      data: ['apple', 'banana'],
      anns_field: 'vector',
      output_fields: ['*'],
      params: { drop_ratio_search: 0.6 },
      consistency_level: ConsistencyLevelEnum.Strong,
    });

    expect(search2.status.error_code).toEqual(ErrorCode.SUCCESS);

    // multiple search
    const search3 = await milvusClient.search({
      collection_name: COLLECTION,
      limit: 10,
      data: [
        {
          data: 'apple',
          anns_field: 'vector',
          params: { nprobe: 2 },
        },
        {
          data: [1, 2, 3, 4],
          anns_field: 'vector',
        },
      ],
      consistency_level: ConsistencyLevelEnum.Strong,
    });

    expect(search3.status.error_code).toEqual(ErrorCode.SUCCESS);
  });
});
