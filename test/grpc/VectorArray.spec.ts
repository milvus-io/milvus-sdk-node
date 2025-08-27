import {
  MilvusClient,
  ErrorCode,
  DataType,
  IndexType,
  MetricType,
} from '../../milvus';
import {
  IP,
  genCollectionParams,
  GENERATE_NAME,
  generateInsertData,
} from '../tools';

const milvusClient = new MilvusClient({
  address: '10.102.7.222:19530',
  logLevel: 'debug',
});
const COLLECTION_NAME = GENERATE_NAME();

const dbParam = {
  db_name: 'vector_array_DB',
};

const p = {
  collectionName: COLLECTION_NAME,
  fields: [
    {
      name: 'struct',
      description: 'struct array field',
      data_type: DataType.ArrayOfStruct,
      max_capacity: 100,
      fields: [
        {
          name: 'arrayOfVector',
          description: 'float vector array field',
          data_type: DataType.ArrayOfVector,
          element_type: DataType.FloatVector,
          dim: 128,
        },
        {
          name: 'varchar',
          description: 'varchar array field',
          data_type: DataType.Array,
          element_type: DataType.VarChar,
          max_length: 100,
        },
      ],
    },
  ],
};
const collectionParams = genCollectionParams(p);
// const data = generateInsertData(collectionParams.fields, 10, {
//   sparseType: 'array',
// });

describe(`Vector array API testing`, () => {
  beforeAll(async () => {
    await milvusClient.createDatabase(dbParam);
    await milvusClient.use(dbParam);
  });

  afterAll(async () => {
    await milvusClient.dropCollection({ collection_name: COLLECTION_NAME });
    await milvusClient.dropDatabase(dbParam);
  });

  it(`Create collection with vector arrays should be successful`, async () => {
    const create = await milvusClient.createCollection(collectionParams);
    expect(create.error_code).toEqual(ErrorCode.SUCCESS);

    const describe = await milvusClient.describeCollection({
      collection_name: COLLECTION_NAME,
    });

    console.dir(describe, { depth: null });

    const vectorArrayFields = describe.schema.fields.filter(
      (field: any) => field.data_type === 'ArrayOfVector'
    );
    expect(vectorArrayFields.length).toBe(1);

    // console.dir(describe.schema, { depth: null });
  });

  //   it(`insert vector array data should be successful`, async () => {
  //     const insert = await milvusClient.insert({
  //       collection_name: COLLECTION_NAME,
  //       data,
  //     });

  //     // console.log('insert', insert);

  //     expect(insert.status.error_code).toEqual(ErrorCode.SUCCESS);
  //     expect(insert.succ_index.length).toEqual(data.length);
  //   });

  //   it(`create index should be successful`, async () => {
  //     const indexes = await milvusClient.createIndex([
  //       {
  //         collection_name: COLLECTION_NAME,
  //         field_name: 'vector',
  //         metric_type: MetricType.IP,
  //         index_type: IndexType.SPARSE_WAND,
  //         params: {
  //           inverted_index_algo: 'DAAT_MAXSCORE',
  //         },
  //       },
  //     ]);

  //     expect(indexes.error_code).toEqual(ErrorCode.SUCCESS);
  //   });

  //   it(`load collection should be successful`, async () => {
  //     const load = await milvusClient.loadCollection({
  //       collection_name: COLLECTION_NAME,
  //     });

  //     expect(load.error_code).toEqual(ErrorCode.SUCCESS);
  //   });

  //   it(`query vector array should be successful`, async () => {
  //     const query = await milvusClient.query({
  //       collection_name: COLLECTION_NAME,
  //       filter: 'id > 0',
  //       output_fields: ['vector', 'id'],
  //     });

  //     // console.dir(query, { depth: null });

  //     const originKeys = Object.keys(query.data[0].vector);
  //     const originValues = Object.values(query.data[0].vector);

  //     const outputKeys: string[] = Object.keys(query.data[0].vector);
  //     const outputValues: number[] = Object.values(query.data[0].vector);

  //     expect(originKeys).toEqual(outputKeys);

  //     // filter  undefined in originValues
  //     originValues.forEach((value, index) => {
  //       if (value) {
  //         expect(value).toBeCloseTo(outputValues[index]);
  //       }
  //     });
  //   });

  //   it(`search with vector array should be successful`, async () => {
  //     const search = await milvusClient.search({
  //       data: data[0].vector,
  //       collection_name: COLLECTION_NAME,
  //       output_fields: ['id', 'vector'],
  //       limit: 5,
  //       params: {
  //         drop_ratio_search: 0.2,
  //         dim_max_score_ratio: 0.9,
  //       },
  //     });

  //     expect(search.status.error_code).toEqual(ErrorCode.SUCCESS);
  //     expect(search.results.length).toBeGreaterThan(0);
  //   });

  //   it(`search with vector array with nq > 1 should be successful`, async () => {
  //     const search = await milvusClient.search({
  //       data: [data[0].vector, data[1].vector],
  //       collection_name: COLLECTION_NAME,
  //       output_fields: ['id', 'vector'],
  //       limit: 5,
  //       params: {
  //         drop_ratio_search: 0.2,
  //         dim_max_score_ratio: 0.9,
  //       },
  //     });

  //     expect(search.status.error_code).toEqual(ErrorCode.SUCCESS);
  //     expect(search.results.length).toEqual(2);
  //   });
});
