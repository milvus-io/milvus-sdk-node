import {
  MilvusClient,
  DataType,
  ErrorCode,
  InsertReq,
  ERROR_REASONS,
} from '../../milvus';
import {
  IP,
  generateInsertData,
  genCollectionParams,
  VECTOR_FIELD_NAME,
  GENERATE_NAME,
  dynamicFields,
} from '../tools';

const milvusClient = new MilvusClient({ address: IP });
const COLLECTION_NAME = GENERATE_NAME();
const BINARY_COLLECTION_NAME = GENERATE_NAME();
const COLLECTION_NAME_AUTO_ID = GENERATE_NAME();
const MORE_SCALAR_COLLECTION_NAME = GENERATE_NAME();
const COLLECTION_NAME_PARAMS = genCollectionParams({
  collectionName: COLLECTION_NAME,
  dim: [4],
  vectorType: [DataType.FloatVector],
  autoID: false,
});
const COLLECTION_NAME_AUTO_ID_PARAMS = genCollectionParams({
  collectionName: COLLECTION_NAME_AUTO_ID,
  dim: [4],
  vectorType: [DataType.FloatVector],
  autoID: true,
  enableDynamic: true,
  fields: [
    {
      name: 'other_ids',
      data_type: DataType.Int32,
      description: '',
    },
  ],
});

const PARTITION_NAME = 'test';
const dbParam = {
  db_name: 'Upsert',
};

describe(`Upsert API`, () => {
  beforeAll(async () => {
    // create db and use db
    await milvusClient.createDatabase(dbParam);
    await milvusClient.use(dbParam);
    // create collection autoid = false and float_vector
    await milvusClient.createCollection(COLLECTION_NAME_PARAMS);
    // create index before load
    await milvusClient.createIndex({
      collection_name: COLLECTION_NAME,
      field_name: VECTOR_FIELD_NAME,
      extra_params: {
        index_type: 'IVF_FLAT',
        metric_type: 'L2',
        params: JSON.stringify({ nlist: 1024 }),
      },
    });

    // create collection autoid = true and float_vector
    await milvusClient.createCollection(COLLECTION_NAME_AUTO_ID_PARAMS);
    // create index before load
    await milvusClient.createIndex({
      collection_name: COLLECTION_NAME_AUTO_ID,
      field_name: VECTOR_FIELD_NAME,
      extra_params: {
        index_type: 'IVF_FLAT',
        metric_type: 'L2',
        params: JSON.stringify({ nlist: 1024 }),
      },
    });
    // load collection
    await milvusClient.loadCollectionSync({
      collection_name: COLLECTION_NAME_AUTO_ID,
    });
    // pare data
    const vectorsData = generateInsertData(
      [...COLLECTION_NAME_AUTO_ID_PARAMS.fields, ...dynamicFields],
      10
    );
    // insert data
    await milvusClient.insert({
      collection_name: COLLECTION_NAME_AUTO_ID,
      fields_data: vectorsData,
    });

    // create collection autoid = false and binary_vector

    await milvusClient.createCollection(
      genCollectionParams({
        collectionName: BINARY_COLLECTION_NAME,
        dim: [8],
        vectorType: [DataType.BinaryVector],
        autoID: false,
      })
    );

    await milvusClient.createPartition({
      collection_name: COLLECTION_NAME,
      partition_name: PARTITION_NAME,
    });
    await milvusClient.createCollection({
      collection_name: MORE_SCALAR_COLLECTION_NAME,
      fields: [
        {
          name: VECTOR_FIELD_NAME,
          description: 'vector field',
          data_type: DataType.FloatVector,
          type_params: {
            dim: '4',
          },
        },
        {
          name: 'id',
          data_type: DataType.Int64,
          is_primary_key: true,
          description: '',
        },
        {
          name: 'int',
          data_type: DataType.Int32,
          description: '',
        },
        {
          name: 'bool',
          data_type: DataType.Bool,
          description: '',
        },
        {
          name: 'double',
          data_type: DataType.Double,
          description: '',
        },
        {
          name: 'float',
          data_type: DataType.Float,
          description: '',
        },
      ],
    });
  });

  afterAll(async () => {
    await milvusClient.dropCollection({
      collection_name: COLLECTION_NAME,
    });

    await milvusClient.dropCollection({
      collection_name: BINARY_COLLECTION_NAME,
    });

    await milvusClient.dropCollection({
      collection_name: COLLECTION_NAME_AUTO_ID,
    });

    await milvusClient.dropCollection({
      collection_name: MORE_SCALAR_COLLECTION_NAME,
    });
    await milvusClient.dropDatabase(dbParam);
  });

  it(`Upsert should throw Collection name validation error`, async () => {
    const errorName = 'my-collection';
    try {
      await milvusClient.upsert({
        collection_name: errorName,
        fields_data: [{}],
      });
    } catch (error) {
      expect(error.status === ErrorCode.IllegalArgument);
    }
  });

  it(`Upsert should throw COLLECTION_NAME_IS_REQUIRED`, async () => {
    try {
      await milvusClient.upsert({} as any);
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.COLLECTION_NAME_IS_REQUIRED);
    }
  });

  it(`Upsert should throw INSERT_CHECK_FIELD_DATA_IS_REQUIRED`, async () => {
    try {
      await milvusClient.upsert({ collection_name: 'asd' } as any);
    } catch (error) {
      expect(error.message).toEqual(
        ERROR_REASONS.INSERT_CHECK_FIELD_DATA_IS_REQUIRED
      );
    }
  });

  it(`Upsert Data on float field and autoId is true expect successful`, async () => {
    const query = await milvusClient.query({
      collection_name: COLLECTION_NAME_AUTO_ID,
      expr: 'id > 0',
      limit: 4,
    });

    const other_ids = query.data.map((item: any) => item.other_ids);

    // modify the bool field to true
    const vectorsData = query.data.map((item: any) => {
      item.bool = true;
      item.dynamic_upserted_int32 = 100;
      item.$meta.dynamic_varChar = 'test';
      item.dynamic_JSON = { a: 1 };
      item.int32_array = null;
      return item;
    });

    // upsert the data
    const params: InsertReq = {
      collection_name: COLLECTION_NAME_AUTO_ID,
      fields_data: vectorsData,
    };

    // expect successful
    const res = await milvusClient.upsert(params);
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);

    // query these id
    const query2 = await milvusClient.query({
      collection_name: COLLECTION_NAME_AUTO_ID,
      expr: `other_ids in [${other_ids.join(',')}]`,
      limit: 4,
    });
    // check the bool field
    expect(query2.data.every((item: any) => item.bool)).toBeTruthy();
    // check the dynamic field
    expect(
      query2.data.every(
        (item: any) => item.$meta.dynamic_upserted_int32 === 100
      )
    ).toBeTruthy();
    expect(
      query2.data.every((item: any) => item.$meta.dynamic_varChar === 'test')
    ).toBeTruthy();
    expect(
      query2.data.every((item: any) => item.$meta.dynamic_JSON.a === 1)
    ).toBeTruthy();
    // check the int32_array field
    expect(
      query2.data.every((item: any) => item.int32_array === null)
    ).toBeTruthy();
  });

  it(`Upsert Data on different scalar fields`, async () => {
    const dataset = [
      {
        [VECTOR_FIELD_NAME]: [1, 2, 3, 4],
        id: 1,
        bool: false,
        int: 1,
        double: 1.12,
        float: 1.3,
      },
    ];
    const params: InsertReq = {
      collection_name: MORE_SCALAR_COLLECTION_NAME,
      fields_data: dataset,
    };

    const res = await milvusClient.upsert(params);
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Upsert Data throw type error`, async () => {
    const dataset = [
      {
        [VECTOR_FIELD_NAME]: [1, 2, 3, 4],
        id: 1,
        bool: false,
        int: 1,
        double: 1.12,
        float: 1.3,
      },
    ];
    const params: InsertReq = {
      collection_name: MORE_SCALAR_COLLECTION_NAME,
      fields_data: dataset,
    };

    const res = await milvusClient.upsert(params);
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Should throw INSERT_CHECK_WRONG_DATA_TYPE `, async () => {
    const fakeClient = new MilvusClient(IP);
    fakeClient.describeCollection = () => {
      return new Promise(res => {
        res({
          status: {
            error_code: 'Success',
            reason: '123',
          },
          schema: {
            fields: [
              {
                name: 'vector',
                data_type: 'Not exist',
                type_params: [
                  {
                    key: 'dim',
                    value: '4',
                  },
                ],
              },
              {
                name: 'id',
                data_type: 'Not exist',
                type_params: [],
              },
            ],
          },
        } as any);
      });
    };

    try {
      const dataset = [
        {
          [VECTOR_FIELD_NAME]: [1, 2, 3, 4],
          id: 1,
        },
      ];
      const params: InsertReq = {
        collection_name: COLLECTION_NAME,
        fields_data: dataset,
      };

      await fakeClient.upsert(params);
      expect('a').toEqual('b');
    } catch (error) {
      expect(error.message).toContain(
        ERROR_REASONS.INSERT_CHECK_WRONG_DATA_TYPE
      );
    } finally {
      fakeClient.closeConnection();
    }
  });

  it(`Delete Data on float `, async () => {
    const res = await milvusClient.deleteEntities({
      collection_name: COLLECTION_NAME,
      expr: 'id in [1,2]',
    });
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Delete Data should throw error `, async () => {
    try {
      await milvusClient.deleteEntities({
        collection_name: COLLECTION_NAME,
      } as any);
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.FILTER_EXPR_REQUIRED);
    }
  });

  it(`Upsert Data on float field expect success`, async () => {
    const vectorsData = generateInsertData(COLLECTION_NAME_PARAMS.fields, 10);

    const params: InsertReq = {
      collection_name: COLLECTION_NAME,
      partition_name: PARTITION_NAME,
      fields_data: vectorsData,
    };

    const res = await milvusClient.upsert(params);
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    await milvusClient.loadCollectionSync({
      collection_name: COLLECTION_NAME,
    });
    const query = await milvusClient.query({
      collection_name: COLLECTION_NAME,
      expr: 'id > 0',
      output_fields: ['json', 'id'],
    });
    expect(query.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Upsert data on float field expect missing field throw error`, async () => {
    const fields = [
      {
        data_type: DataType.FloatVector,
        dim: 4,
        name: VECTOR_FIELD_NAME,
      },
      {
        data_type: DataType.Int16,
        name: 'id',
      },
    ];
    const fieldsData = generateInsertData(fields, 10);

    const params: InsertReq = {
      collection_name: COLLECTION_NAME,
      partition_name: PARTITION_NAME,
      fields_data: fieldsData,
    };

    try {
      await milvusClient.upsert(params);
    } catch (error) {
      expect(error.message).toContain('Insert fail');
    }
  });

  it(`Upsert data on float field expect throw wrong field error`, async () => {
    const fields = [
      {
        data_type: DataType.FloatVector,
        dim: 4,
        name: 'float_vector2',
      },
      {
        data_type: DataType.Int16,
        name: 'id',
      },
    ];
    const fieldsData = generateInsertData(fields, 10);

    const params: InsertReq = {
      collection_name: COLLECTION_NAME,
      partition_name: PARTITION_NAME,
      fields_data: fieldsData,
    };

    try {
      await milvusClient.upsert(params);
    } catch (error) {
      expect(error.message).toContain('Insert fail');
    }
  });

  it(`Upsert data on float field expect throw dimension equal error`, async () => {
    const fields = [
      {
        data_type: DataType.FloatVector,
        dim: 2,
        name: VECTOR_FIELD_NAME,
      },
      {
        data_type: DataType.Int16,
        name: 'id',
      },
    ];
    const fieldsData = generateInsertData(fields, 10);

    const params: InsertReq = {
      collection_name: COLLECTION_NAME,
      partition_name: PARTITION_NAME,
      fields_data: fieldsData,
    };

    try {
      await milvusClient.upsert(params);
    } catch (error) {
      expect(error.message).toContain('Insert fail');
    }
  });

  it(`Upsert should throw describeCollection error`, async () => {
    const fakeClient = new MilvusClient(IP);

    fakeClient.describeCollection = () => {
      return new Promise(res => {
        res({
          status: {
            error_code: 'error',
            reason: 'error',
          },
        } as any);
      });
    };
    try {
      await fakeClient.insert({
        collection_name: COLLECTION_NAME,
        fields_data: [{ a: 1 }],
      });
      expect('a').toEqual('b');
    } catch (error) {
      expect(error.status.reason).toBe('error');
    } finally {
      fakeClient.closeConnection();
    }
  });

  it(`Upsert into binary field should throw error`, async () => {
    const fields = [
      {
        data_type: DataType.FloatVector,
        dim: 8,
        name: VECTOR_FIELD_NAME,
      },
    ];
    const vectorsData = generateInsertData(fields, 10);
    const params: InsertReq = {
      collection_name: BINARY_COLLECTION_NAME,
      fields_data: vectorsData,
    };
    try {
      await milvusClient.insert(params);
      // If not throw error, test fail
      expect('a').toEqual('b');
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.INSERT_CHECK_WRONG_DIM);
    }
  });
});
