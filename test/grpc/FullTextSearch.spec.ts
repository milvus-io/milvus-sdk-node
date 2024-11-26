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
      name: 'sparse',
      description: 'sparse field',
      data_type: DataType.SparseFloatVector,
      is_function_output: true,
    },
    {
      name: 'sparse2',
      description: 'sparse field2',
      data_type: DataType.SparseFloatVector,
    },
  ],
  functions: [
    {
      name: 'bm25f1',
      description: 'bm25 function',
      type: FunctionType.BM25,
      input_field_names: ['text'],
      output_field_names: ['sparse'],
      params: {},
    },
    {
      name: 'bm25f2',
      description: 'bm25 function',
      type: FunctionType.BM25,
      input_field_names: ['text'],
      output_field_names: ['sparse2'],
      params: {},
    },
  ],
});

describe(`FulltextSearch API`, () => {
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
    // expect the 'sparse' field to be created
    expect(describe.schema.fields.length).toEqual(
      createCollectionParams.fields.length
    );
    // extract the 'sparse' field
    const sparse = describe.schema.fields.find(
      field => field.is_function_output
    );

    // expect the 'sparse' field's name to be 'sparse'
    expect(sparse!.name).toEqual('sparse');

    // expect functions are in the schema
    expect(describe.schema.functions.length).toEqual(2);
    expect(describe.schema.functions[0].name).toEqual('bm25f1');
    expect(describe.schema.functions[0].input_field_names).toEqual(['text']);
    expect(describe.schema.functions[0].output_field_names).toEqual(['sparse']);
    expect(describe.schema.functions[0].type).toEqual('BM25');
    expect(describe.schema.functions[1].name).toEqual('bm25f2');
    expect(describe.schema.functions[1].input_field_names).toEqual(['text']);
    expect(describe.schema.functions[1].output_field_names).toEqual([
      'sparse2',
    ]);
    expect(describe.schema.functions[1].type).toEqual('BM25');

    // find the `sparse2` field
    const sparse2 = describe.schema.fields.find(
      field => field.name === 'sparse2'
    );
    // its function output should be true
    expect(sparse2!.is_function_output).toEqual(true);
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
    // create index
    const createVectorIndex = await milvusClient.createIndex({
      collection_name: COLLECTION,
      index_name: 't',
      field_name: 'vector',
      index_type: 'HNSW',
      metric_type: MetricType.COSINE,
      params: { M: 4, efConstruction: 8 },
    });

    const createIndex = await milvusClient.createIndex({
      collection_name: COLLECTION,
      index_name: 't2',
      field_name: 'sparse',
      index_type: 'SPARSE_INVERTED_INDEX',
      metric_type: 'BM25',
      params: { drop_ratio_build: 0.3, bm25_k1: 1.25, bm25_b: 0.8 },
    });

    const createIndex2 = await milvusClient.createIndex({
      collection_name: COLLECTION,
      index_name: 't3',
      field_name: 'sparse2',
      index_type: 'SPARSE_INVERTED_INDEX',
      metric_type: 'BM25',
      params: { drop_ratio_build: 0.3, bm25_k1: 1.25, bm25_b: 0.8 },
    });

    expect(createVectorIndex.error_code).toEqual(ErrorCode.SUCCESS);
    expect(createIndex.error_code).toEqual(ErrorCode.SUCCESS);
    expect(createIndex2.error_code).toEqual(ErrorCode.SUCCESS);

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
      output_fields: ['vector', 'id', 'text', 'sparse', 'sparse2'],
      consistency_level: ConsistencyLevelEnum.Strong,
    });

    expect(query.status.error_code).toEqual(ErrorCode.UnexpectedError);
    expect(query.status.reason).toEqual(
      'not allowed to retrieve raw data of field sparse'
    );

    const query2 = await milvusClient.query({
      collection_name: COLLECTION,
      limit: 10,
      expr: 'id > 0',
      output_fields: ['vector', 'id', 'text', '$meta'],
      consistency_level: ConsistencyLevelEnum.Strong,
    });

    expect(query2.data.length).toEqual(10);
  });

  it(`search with varchar should success`, async () => {
    // search nq = 1
    const search = await milvusClient.search({
      collection_name: COLLECTION,
      limit: 10,
      data: 'apple',
      anns_field: 'sparse',
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
      anns_field: 'sparse',
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
          anns_field: 'sparse',
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
