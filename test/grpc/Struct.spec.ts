import {
  MilvusClient,
  ErrorCode,
  DataType,
  IndexType,
  MetricType,
} from '../../milvus';
import { IP, GENERATE_NAME, generateInsertData } from '../tools';

const milvusClient = new MilvusClient({
  address: IP,
  logLevel: 'debug',
});
const COLLECTION_NAME = GENERATE_NAME();

const dbParam = {
  db_name: 'struct_DB',
};

const collectionParams = {
  collection_name: COLLECTION_NAME,
  fields: [
    {
      name: 'id',
      description: 'id field',
      data_type: DataType.Int64,
      is_primary_key: true,
      autoID: true,
    },
    {
      name: 'vector',
      description: 'vector field',
      data_type: DataType.FloatVector,
      dim: 4,
    },
    {
      name: 'varChar',
      description: 'varChar field',
      data_type: DataType.VarChar,
      max_length: 128,
      is_partition_key: false,
    },
    {
      name: 'array_of_varchar',
      description: 'array of varchar field',
      data_type: DataType.Array,
      element_type: DataType.VarChar,
      max_capacity: 100,
      max_length: 128,
      is_partition_key: false,
    },
    {
      name: 'array_of_struct',
      description: 'struct array field',
      data_type: DataType.Array,
      element_type: DataType.Struct,
      max_capacity: 4,
      fields: [
        {
          name: 'int64_of_struct0',
          description: 'int64 field',
          data_type: DataType.Int64,
        },
        {
          name: 'bool_of_struct0',
          description: 'bool field',
          data_type: DataType.Bool,
        },
      ],
    },
    {
      name: 'array_of_vector_struct',
      description: 'struct array field',
      data_type: DataType.Array,
      element_type: DataType.Struct,
      max_capacity: 4,
      fields: [
        {
          name: 'float_vector_of_struct',
          description: 'float vector array field',
          data_type: DataType.FloatVector,
          dim: 4,
        },
        {
          name: 'float16_vector_of_struct',
          description: 'float vector array field',
          data_type: DataType.Float16Vector,
          dim: 4,
        },
        {
          name: 'int8_vector_of_struct',
          description: 'int8 vector array field',
          data_type: DataType.Int8Vector,
          dim: 4,
        },
        {
          name: 'int64_of_struct',
          description: 'int64 field',
          data_type: DataType.Int64,
        },
        {
          name: 'bool_of_struct',
          description: 'bool field',
          data_type: DataType.Bool,
        },
        {
          name: 'float_of_struct',
          description: 'float field',
          data_type: DataType.Float,
        },
        {
          name: 'double_of_struct',
          description: 'double field',
          data_type: DataType.Double,
        },
        {
          name: 'varchar_of_struct',
          description: 'varchar field',
          data_type: DataType.VarChar,
          max_length: 4,
        },
      ],
    },
  ],
};
// const data = generateInsertData(collectionParams.fields, 10, {
//   sparseType: 'array',
// });

describe(`Struct API testing`, () => {
  beforeAll(async () => {
    await milvusClient.createDatabase(dbParam);
    await milvusClient.use(dbParam);
  });

  afterAll(async () => {
    await milvusClient.dropCollection({ collection_name: COLLECTION_NAME });
    await milvusClient.dropDatabase(dbParam);
  });

  it(`Create collection with struct should be successful`, async () => {
    const create = await milvusClient.createCollection(collectionParams);
    expect(create.error_code).toEqual(ErrorCode.SUCCESS);

    const describe = await milvusClient.describeCollection({
      collection_name: COLLECTION_NAME,
    });

    console.dir(describe, { depth: null });

    // check schema length
    expect(describe.schema.fields.length).toEqual(
      collectionParams.fields.length
    );

    // check struct array field
    const structArrayFields = describe.schema.fields.filter(
      (field: any) =>
        field.data_type === 'Array' && field.element_type === 'Struct'
    );

    expect(structArrayFields.length).toEqual(2);

    expect(structArrayFields[0]).toBeDefined();
    expect(structArrayFields[0]!.dataType).toEqual(DataType.Array);
    expect(structArrayFields[0]!.element_type).toEqual('Struct');
    expect(structArrayFields[0]!.fields!.length).toEqual(
      collectionParams.fields[4].fields!.length
    );
    expect(structArrayFields[0]!.fields![0].dataType).toEqual(DataType.Int64);
    expect(structArrayFields[0]!.fields![1].dataType).toEqual(DataType.Bool);

    expect(structArrayFields[1]).toBeDefined();
    expect(structArrayFields[1]!.dataType).toEqual(DataType.Array);
    expect(structArrayFields[1]!.element_type).toEqual('Struct');
    expect(structArrayFields[1]!.fields!.length).toEqual(
      collectionParams.fields[5].fields!.length
    );
    expect(structArrayFields[1]!.fields![0].dataType).toEqual(
      DataType.FloatVector
    );
    expect(structArrayFields[1]!.fields![0].dim).toEqual('4');
    expect(structArrayFields[1]!.fields![1].dataType).toEqual(
      DataType.Float16Vector
    );
    expect(structArrayFields[1]!.fields![1].dim).toEqual('4');
    expect(structArrayFields[1]!.fields![2].dataType).toEqual(
      DataType.Int8Vector
    );
    expect(structArrayFields[1]!.fields![2].dim).toEqual('4');
    expect(structArrayFields[1]!.fields![3].dataType).toEqual(DataType.Int64);
    expect(structArrayFields[1]!.fields![4].dataType).toEqual(DataType.Bool);
    expect(structArrayFields[1]!.fields![5].dataType).toEqual(DataType.Float);
    expect(structArrayFields[1]!.fields![6].dataType).toEqual(DataType.Double);
    expect(structArrayFields[1]!.fields![7].dataType).toEqual(DataType.VarChar);
    expect(structArrayFields[1]!.fields![7].max_length).toEqual('4');

    // expect(vectorArrayFields.length).toBe(1);

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
