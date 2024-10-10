import { MilvusClient, DataType, ErrorCode } from '../../milvus';
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
  db_name: 'Functions',
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
  withFunctions: true,
});

describe(`Functions schema API`, () => {
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
    console.dir(describe, { depth: null });
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
    expect(describe.schema.functions.length).toEqual(1);
    expect(describe.schema.functions[0].name).toEqual('bm25');
    expect(describe.schema.functions[0].input_field_names).toEqual(['varChar']);
    expect(describe.schema.functions[0].output_field_names).toEqual(['sparse']);
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
    // create index
    const createIndex = await milvusClient.createIndex({
      collection_name: COLLECTION,
      index_name: 't',
      field_name: 'sparse',
      index_type: 'SPARSE_INVERTED_INDEX',
      metric_type: 'BM25',
      params: { drop_ratio_build: 0.3, bm25_k1: 1.25, bm25_b: 0.8 },
    });

    expect(createIndex.error_code).toEqual(ErrorCode.SUCCESS);

    // load
    const load = await milvusClient.loadCollection({
      collection_name: COLLECTION,
    });

    expect(load.error_code).toEqual(ErrorCode.SUCCESS);
  });

  // it(`query with function output field should success`, async () => {
  //   // query
  //   const query = await milvusClient.query({
  //     collection_name: COLLECTION,
  //     limit: 10,
  //     expr: 'id > 0',
  //     output_fields: [
  //       'json',
  //       'vector',
  //       'id',
  //       'dynamic_int64',
  //       'dynamic_varChar',
  //       'function_output',
  //     ],
  //     consistency_level: ConsistencyLevelEnum.Session,
  //   });

  //   expect(query.status.error_code).toEqual(ErrorCode.SUCCESS);
  //   expect(query.data.length).toEqual(10);
  // });

  // it(`search with function field should success`, async () => {
  //   // search
  //   const search = await milvusClient.search({
  //     collection_name: COLLECTION,
  //     limit: 10,
  //     data: [
  //       [1, 2, 3, 4],
  //       [1, 2, 3, 4],
  //     ],
  //     expr: 'id > 0',
  //     output_fields: ['*'],
  //     consistency_level: ConsistencyLevelEnum.Session,
  //   });

  //   expect(search.status.error_code).toEqual(ErrorCode.SUCCESS);
  //   expect(search.results.length).toEqual(2);
  //   expect(search.results[0].length).toEqual(10);

  //   // search
  //   const search2 = await milvusClient.search({
  //     collection_name: COLLECTION,
  //     limit: 10,
  //     data: [1, 2, 3, 4],
  //     expr: 'id > 0',
  //     output_fields: ['json', 'id', 'dynamic_int64', 'function_output'],
  //   });
  //   expect(search2.status.error_code).toEqual(ErrorCode.SUCCESS);
  //   expect(search2.results.length).toEqual(10);
  // });
});
