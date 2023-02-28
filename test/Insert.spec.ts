import { MilvusClient } from '../milvus';
import { IP } from '../const';
import { DataType } from '../milvus/const/Milvus';
import { ErrorCode } from '../milvus/types/Response';
import { InsertReq } from '../milvus/types/Data';
import { generateInsertData } from '../utils/test';
import {
  genCollectionParams,
  VECTOR_FIELD_NAME,
  GENERATE_NAME,
} from '../utils/test';
import { ERROR_REASONS } from '../milvus/const/ErrorReason';

let milvusClient = new MilvusClient(IP);
const COLLECTION_NAME = GENERATE_NAME();
const BINARY_COLLECTION_NAME = GENERATE_NAME();
const COLLECTION_NAME_AUTO_ID = GENERATE_NAME();
const MORE_SCALAR_COLLECTION_NAME = GENERATE_NAME();

const PARTITION_NAME = 'test';
describe('Insert data Api', () => {
  beforeAll(async () => {
    // create collection autoid = false and float_vector
    await milvusClient.collectionManager.createCollection(
      genCollectionParams(COLLECTION_NAME, '4', DataType.FloatVector, false)
    );
    // create index before load
    await milvusClient.indexManager.createIndex({
      collection_name: COLLECTION_NAME,
      field_name: VECTOR_FIELD_NAME,
      extra_params: {
        index_type: 'IVF_FLAT',
        metric_type: 'L2',
        params: JSON.stringify({ nlist: 1024 }),
      },
    });

    // create collection autoid = true and float_vector
    await milvusClient.collectionManager.createCollection(
      genCollectionParams(COLLECTION_NAME_AUTO_ID, '4')
    );

    // create collection autoid = false and binary_vector

    await milvusClient.collectionManager.createCollection(
      genCollectionParams(
        BINARY_COLLECTION_NAME,
        '8',
        DataType.BinaryVector,
        false
      )
    );

    await milvusClient.partitionManager.createPartition({
      collection_name: COLLECTION_NAME,
      partition_name: PARTITION_NAME,
    });
    await milvusClient.collectionManager.createCollection({
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
          name: 'age',
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
    await milvusClient.collectionManager.dropCollection({
      collection_name: COLLECTION_NAME,
    });

    await milvusClient.collectionManager.dropCollection({
      collection_name: BINARY_COLLECTION_NAME,
    });

    await milvusClient.collectionManager.dropCollection({
      collection_name: COLLECTION_NAME_AUTO_ID,
    });

    await milvusClient.collectionManager.dropCollection({
      collection_name: MORE_SCALAR_COLLECTION_NAME,
    });
  });

  it(`Insert should throw COLLECTION_NAME_IS_REQUIRED`, async () => {
    try {
      await milvusClient.dataManager.insert({} as any);
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.COLLECTION_NAME_IS_REQUIRED);
    }
  });

  it(`Insert should throw INSERT_CHECK_FILEDS_DATA_IS_REQUIRED`, async () => {
    try {
      await milvusClient.dataManager.insert({ collection_name: 'asd' } as any);
    } catch (error) {
      expect(error.message).toEqual(
        ERROR_REASONS.INSERT_CHECK_FILEDS_DATA_IS_REQUIRED
      );
    }
  });

  it(`Insert Data on float field and autoId is true expect success`, async () => {
    const fields = [
      {
        isVector: true,
        dim: 4,
        name: VECTOR_FIELD_NAME,
      },
    ];
    const vectorsData = generateInsertData(fields, 10);

    const params: InsertReq = {
      collection_name: COLLECTION_NAME_AUTO_ID,
      fields_data: vectorsData,
    };

    const res = await milvusClient.dataManager.insert(params);
    // console.log('----generateInsertData ----', res);
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Insert Data on different scalar fields`, async () => {
    const dataset = [
      {
        [VECTOR_FIELD_NAME]: [1, 2, 3, 4],
        age: 1,
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

    const res = await milvusClient.dataManager.insert(params);
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Insert Data throw type error`, async () => {
    const dataset = [
      {
        [VECTOR_FIELD_NAME]: [1, 2, 3, 4],
        age: 1,
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

    const res = await milvusClient.dataManager.insert(params);
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Should throw INSERT_CHECK_WRONG_DATA_TYPE `, async () => {
    const fakeClient = new MilvusClient(IP);
    fakeClient.collectionManager.describeCollection = () => {
      return new Promise(res => {
        res({
          status: {
            error_code: 'Success',
            reason: '123',
          },
          schema: {
            fields: [
              {
                name: 'vector_field',
                data_type: 'Not exist',
                type_params: [
                  {
                    key: 'dim',
                    value: '4',
                  },
                ],
              },
              {
                name: 'age',
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
          age: 1,
        },
      ];
      const params: InsertReq = {
        collection_name: COLLECTION_NAME,
        fields_data: dataset,
      };

      await fakeClient.dataManager.insert(params);
      expect('a').toEqual('b');
    } catch (error) {
      // console.log('---error----', error);
      expect(error.message).toEqual(ERROR_REASONS.INSERT_CHECK_WRONG_DATA_TYPE);
    } finally {
      fakeClient.closeConnection();
    }
  });

  it(`Delete Data on float `, async () => {
    const res = await milvusClient.dataManager.deleteEntities({
      collection_name: COLLECTION_NAME,
      expr: 'age in [1,2]',
    });
    // console.log('----deleteEntities ----', res);
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Delete Data should throw error `, async () => {
    try {
      await milvusClient.dataManager.deleteEntities({
        collection_name: COLLECTION_NAME,
      } as any);
      expect('a').toEqual('b');
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.DELETE_PARAMS_CHECK);
    }
  });

  it(`Insert Data on float field expect success`, async () => {
    const fields = [
      {
        isVector: true,
        dim: 4,
        name: VECTOR_FIELD_NAME,
      },
      {
        isVector: false,
        name: 'age',
      },
    ];
    const vectorsData = generateInsertData(fields, 10);

    const params: InsertReq = {
      collection_name: COLLECTION_NAME,
      partition_name: PARTITION_NAME,
      fields_data: vectorsData,
    };

    const res = await milvusClient.dataManager.insert(params);
    await milvusClient.collectionManager.loadCollectionSync({
      collection_name: COLLECTION_NAME,
    });

    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Insert data on float field expect missing field throw error`, async () => {
    const fields = [
      {
        isVector: true,
        dim: 4,
        name: VECTOR_FIELD_NAME,
      },
      {
        isVector: false,
        name: 'age',
      },
    ];
    const fieldsData = generateInsertData(fields, 10);

    const params: InsertReq = {
      collection_name: COLLECTION_NAME,
      partition_name: PARTITION_NAME,
      fields_data: fieldsData,
    };

    try {
      await milvusClient.dataManager.insert(params);
    } catch (error) {
      expect(error.message).toContain('Insert fail');
    }
  });

  it(`Insert data on float field expect throw wrong field error`, async () => {
    const fields = [
      {
        isVector: true,
        dim: 4,
        name: 'float_vector2',
      },
      {
        isVector: false,
        name: 'age',
      },
    ];
    const fieldsData = generateInsertData(fields, 10);

    const params: InsertReq = {
      collection_name: COLLECTION_NAME,
      partition_name: PARTITION_NAME,
      fields_data: fieldsData,
    };

    try {
      await milvusClient.dataManager.insert(params);
    } catch (error) {
      expect(error.message).toContain('Insert fail');
    }
  });

  it(`Insert data on float field expect throw dimension equal error`, async () => {
    const fields = [
      {
        isVector: true,
        dim: 2,
        name: VECTOR_FIELD_NAME,
      },
      {
        isVector: false,
        name: 'age',
      },
    ];
    const fieldsData = generateInsertData(fields, 10);

    const params: InsertReq = {
      collection_name: COLLECTION_NAME,
      partition_name: PARTITION_NAME,
      fields_data: fieldsData,
    };

    try {
      await milvusClient.dataManager.insert(params);
    } catch (error) {
      // console.log(error);
      expect(error.message).toContain('Insert fail');
    }
  });

  it(`Insert should throw describeCollection error`, async () => {
    const fakeClient = new MilvusClient(IP);

    fakeClient.collectionManager.describeCollection = () => {
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
      await fakeClient.dataManager.insert({
        collection_name: COLLECTION_NAME,
        fields_data: [{ a: 1 }],
      });
      expect('a').toEqual('b');
    } catch (error) {
      // console.log(error);
      expect(error.message).toBe('error');
    } finally {
      fakeClient.closeConnection();
    }
  });

  it('Insert into binary field should throw error', async () => {
    const fields = [
      {
        isVector: true,
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
      await milvusClient.dataManager.insert(params);
      // If not throw error, test fail
      expect('a').toEqual('b');
    } catch (error) {
      // console.log(error);
      expect(error.message).toEqual(ERROR_REASONS.INSERT_CHECK_WRONG_DIM);
    }
  });
});
