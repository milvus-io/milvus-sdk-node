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
  consistency_level: 'Strong',
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
      max_length: 10,
      is_partition_key: false,
    },
    {
      name: 'array_of_varchar',
      description: 'array of varchar field',
      data_type: DataType.Array,
      element_type: DataType.VarChar,
      max_capacity: 4,
      max_length: 10,
      is_partition_key: false,
    },
    {
      name: 'array_of_struct',
      description: 'struct array field',
      data_type: DataType.Array,
      element_type: DataType.Struct,
      max_capacity: 2,
      fields: [
        {
          name: 'int32_of_struct0',
          description: 'int32 field',
          data_type: DataType.Int32,
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
      max_capacity: 2,
      fields: [
        {
          name: 'float_vector_of_struct',
          description: 'float vector array field',
          data_type: DataType.FloatVector,
          dim: 4,
        },
        // {
        //   name: 'float16_vector_of_struct',
        //   description: 'float vector array field',
        //   data_type: DataType.Float16Vector,
        //   dim: 4,
        // },
        // {
        //   name: 'int8_vector_of_struct',
        //   description: 'int8 vector array field',
        //   data_type: DataType.Int8Vector,
        //   dim: 4,
        // },
        // {
        //   name: 'int64_of_struct',
        //   description: 'int64 field',
        //   data_type: DataType.Int64,
        // },
        {
          name: 'bool_of_struct',
          description: 'bool field',
          data_type: DataType.Bool,
        },
        // {
        //   name: 'float_of_struct',
        //   description: 'float field',
        //   data_type: DataType.Float,
        // },
        // {
        //   name: 'double_of_struct',
        //   description: 'double field',
        //   data_type: DataType.Double,
        // },
        // {
        //   name: 'varchar_of_struct',
        //   description: 'varchar field',
        //   data_type: DataType.VarChar,
        //   max_length: 10,
        // },
      ],
    },
  ],
};

const data = generateInsertData(collectionParams.fields, 5);

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
    expect(structArrayFields[0]!.fields![0].dataType).toEqual(DataType.Int32);
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
    expect(structArrayFields[1]!.fields![1].dataType).toEqual(DataType.Bool);

    // expect(structArrayFields[1]!.fields![1].dataType).toEqual(
    //   DataType.Float16Vector
    // );
    // expect(structArrayFields[1]!.fields![1].dim).toEqual('4');
    // expect(structArrayFields[1]!.fields![2].dataType).toEqual(
    //   DataType.Int8Vector
    // );
    // expect(structArrayFields[1]!.fields![2].dim).toEqual('4');
    // expect(structArrayFields[1]!.fields![3].dataType).toEqual(DataType.Int64);
    // expect(structArrayFields[1]!.fields![4].dataType).toEqual(DataType.Bool);
    // expect(structArrayFields[1]!.fields![5].dataType).toEqual(DataType.Float);
    // expect(structArrayFields[1]!.fields![6].dataType).toEqual(DataType.Double);
    // expect(structArrayFields[1]!.fields![7].dataType).toEqual(DataType.VarChar);
    // expect(structArrayFields[1]!.fields![7].max_length).toEqual('4');

    // expect(vectorArrayFields.length).toBe(1);

    // console.dir(describe.schema, { depth: null });
  });

  it(`insert vector array data should be successful`, async () => {
    const insert = await milvusClient.insert({
      collection_name: COLLECTION_NAME,
      data,
    });

    expect(insert.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(insert.succ_index.length).toEqual(data.length);
  });

  it(`create index should be successful`, async () => {
    const indexes = await milvusClient.createIndex([
      {
        collection_name: COLLECTION_NAME,
        field_name: 'vector',
        metric_type: MetricType.COSINE,
        index_type: IndexType.AUTOINDEX,
      },
      {
        collection_name: COLLECTION_NAME,
        index_name: 'array_of_vector_struct_hnsw0',
        field_name: 'array_of_vector_struct[float_vector_of_struct]',
        metric_type: MetricType.MAX_SIM,
        index_type: IndexType.HNSW,
      },
    ]);

    expect(indexes.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`load collection should be successful`, async () => {
    const load = await milvusClient.loadCollection({
      collection_name: COLLECTION_NAME,
    });

    expect(load.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`query vector array should be successful`, async () => {
    const count = await milvusClient.count({
      collection_name: COLLECTION_NAME,
    });

    expect(count.data).toEqual(data.length);

    const query = await milvusClient.query({
      collection_name: COLLECTION_NAME,
      filter: 'id > 0',
      output_fields: [
        'vector',
        'id',
        'array_of_struct',
        'array_of_vector_struct',
      ],
    });

    query.data.forEach((item: any, index: number) => {
      expect(item.array_of_struct.length).toEqual(2);
      item.array_of_struct.forEach((struct: any, structIndex: number) => {
        expect(struct.int32_of_struct0).toEqual(
          data[index].array_of_struct[structIndex].int32_of_struct0
        );
        expect(struct.bool_of_struct0).toEqual(
          data[index].array_of_struct[structIndex].bool_of_struct0
        );
      });
      expect(item.array_of_vector_struct.length).toEqual(2);
      item.array_of_vector_struct.forEach(
        (vector: any, vectorIndex: number) => {
          // verify the float vector, may lose some precision
          vector.float_vector_of_struct.forEach((v: number, i: number) => {
            expect(v).toBeCloseTo(
              data[index].array_of_vector_struct[vectorIndex]
                .float_vector_of_struct[i]
            );
          });
          expect(vector.bool_of_struct).toEqual(
            data[index].array_of_vector_struct[vectorIndex].bool_of_struct
          );
        }
      );
    });
  });

  it(`search with vector should be successful`, async () => {
    const search = await milvusClient.search({
      data: data[0].vector,
      collection_name: COLLECTION_NAME,
      output_fields: [
        'id',
        'vector',
        'array_of_struct',
        'array_of_vector_struct',
      ],
      limit: 5,
    });

    expect(search.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(search.results.length).toBeGreaterThan(0);
    // expect fields exist
    search.results.forEach((result: any) => {
      expect(result.array_of_struct).toBeDefined();
      expect(result.array_of_vector_struct).toBeDefined();
    });
    search.results.forEach((result: any) => {
      result.array_of_struct.forEach((struct: any) => {
        expect(struct.int32_of_struct0).toBeDefined();
        expect(struct.bool_of_struct0).toBeDefined();
      });
    });
    search.results.forEach((result: any) => {
      result.array_of_vector_struct.forEach((vector: any) => {
        expect(vector.float_vector_of_struct).toBeDefined();
        expect(vector.bool_of_struct).toBeDefined();
      });
    });
  });

  it(`search with vector array with nq > 1 should be successful`, async () => {
    const search = await milvusClient.search({
      data: [data[0].vector, data[1].vector],
      collection_name: COLLECTION_NAME,
      output_fields: [
        'id',
        'vector',
        'array_of_struct',
        'array_of_vector_struct',
      ],
      limit: 5,
    });

    expect(search.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(search.results.length).toEqual(2);
  });

  it(`search with emblist should be successful`, async () => {
    const emblist = [data[0].vector, data[1].vector];
    const search = await milvusClient.search({
      data: emblist,
      collection_name: COLLECTION_NAME,
      anns_field: 'array_of_vector_struct[float_vector_of_struct]',
      output_fields: [
        'id',
        'vector',
        'array_of_struct',
        'array_of_vector_struct',
      ],
      limit: 5,
    });

    expect(search.status.error_code).toEqual(ErrorCode.SUCCESS);
    // expect(search.results.length).toBeGreaterThan(0);
    // // expect fields exist
    // search.results.forEach((result: any) => {
    //   expect(result.array_of_struct).toBeDefined();
    //   expect(result.array_of_vector_struct).toBeDefined();
    // });
    // search.results.forEach((result: any) => {
    //   result.array_of_struct.forEach((struct: any) => {
    //     expect(struct.int32_of_struct0).toBeDefined();
    //     expect(struct.bool_of_struct0).toBeDefined();
    //   });
    // });
    // search.results.forEach((result: any) => {
    //   result.array_of_vector_struct.forEach((vector: any) => {
    //     expect(vector.float_vector_of_struct).toBeDefined();
    //     expect(vector.bool_of_struct).toBeDefined();
    //   });
    // });
  });
});
