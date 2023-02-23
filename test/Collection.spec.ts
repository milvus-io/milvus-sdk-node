import { MilvusClient } from '../milvus';

import { GENERATE_NAME, IP } from '../const';
import { DataType } from '../milvus/types/Common';
import { ErrorCode } from '../milvus/types/Response';
import { ShowCollectionsType } from '../milvus/types/Collection';
import { ERROR_REASONS } from '../milvus/const/ErrorReason';
import { genCollectionParams, VECTOR_FIELD_NAME } from '../utils/test';
import { timeoutTest } from './common/timeout';

const milvusClient = new MilvusClient(IP);
const collectionManager = milvusClient.collectionManager;
const COLLECTION_NAME = GENERATE_NAME();
const NEW_COLLECTION_NAME = GENERATE_NAME();
const TEST_CONSISTENCY_LEVEL_COLLECTION_NAME = GENERATE_NAME();
const LOAD_COLLECTION_NAME = GENERATE_NAME();
const LOAD_COLLECTION_NAME_SYNC = GENERATE_NAME();
const ALIAS = 'my_alias';

describe('Collection Api', () => {
  it(`Create Collection Successful`, async () => {
    const res = await collectionManager.createCollection({
      ...genCollectionParams(COLLECTION_NAME, '128'),
      consistency_level: 'Eventually',
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Create Collection validate fields`, async () => {
    try {
      await collectionManager.createCollection({
        collection_name: 'zxc',
      } as any);
    } catch (error) {
      expect(error.message).toEqual(
        ERROR_REASONS.CREATE_COLLECTION_CHECK_PARAMS
      );
    }
    try {
      await collectionManager.createCollection({
        collection_name: 'zxc',
        fields: [
          {
            name: 'vector_01',
            description: 'vector field',
            data_type: DataType.FloatVector,
          },
        ],
      });
    } catch (error) {
      expect(error.message).toEqual(
        ERROR_REASONS.CREATE_COLLECTION_CHECK_PRIMARY_KEY
      );
    }

    try {
      await collectionManager.createCollection({
        collection_name: 'zxc',
        fields: [
          {
            name: 'age',
            description: '',
            data_type: DataType.Int64,
            is_primary_key: true,
          },
        ],
      });
    } catch (error) {
      expect(error.message).toEqual(
        ERROR_REASONS.CREATE_COLLECTION_CHECK_VECTOR_FIELD_EXIST
      );
    }
  });

  it(`Create Collection expect dim error`, async () => {
    try {
      await collectionManager.createCollection({
        collection_name: 'zxc',
        fields: [
          {
            name: 'vector_01',
            description: 'vector field',
            data_type: DataType.FloatVector,
          },
          {
            name: 'age',
            description: '',
            data_type: DataType.Int64,
            is_primary_key: true,
          },
        ],
      });
    } catch (error) {
      expect(error.message).toEqual(
        ERROR_REASONS.CREATE_COLLECTION_CHECK_MISS_DIM
      );
    }

    try {
      const d = await collectionManager.createCollection(
        genCollectionParams('any', '10')
      );
    } catch (error) {
      expect(error.message).toEqual(
        ERROR_REASONS.CREATE_COLLECTION_CHECK_BINARY_DIM
      );
    }
  });

  it('Create collection should throw CREATE_COLLECTION_CHECK_BINARY_DIM', async () => {
    try {
      await collectionManager.createCollection({
        collection_name: 'zxc',
        fields: [
          {
            name: 'vector_01',
            description: 'vector field',
            data_type: DataType.BinaryVector,
            type_params: {
              dim: '7',
            },
          },
          {
            name: 'age',
            description: '',
            data_type: DataType.Int64,
            is_primary_key: true,
          },
        ],
      });
    } catch (error) {
      expect(error.message).toEqual(
        ERROR_REASONS.CREATE_COLLECTION_CHECK_BINARY_DIM
      );
    }
  });

  it('Create collection should throw check params error', async () => {
    try {
      await collectionManager.createCollection({} as any);
    } catch (error) {
      expect(error.message).toEqual(
        ERROR_REASONS.CREATE_COLLECTION_CHECK_PARAMS
      );
    }
  });

  it('Create collection will be successful even if passed consistency level is invalid', async () => {
    const res = await collectionManager.createCollection({
      ...genCollectionParams(TEST_CONSISTENCY_LEVEL_COLLECTION_NAME, '128'),
      consistency_level: 'xxx' as any,
    });

    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Create load Collection Successful`, async () => {
    const res1 = await collectionManager.createCollection(
      genCollectionParams(LOAD_COLLECTION_NAME, '128')
    );
    const res2 = await collectionManager.createCollection(
      genCollectionParams(LOAD_COLLECTION_NAME_SYNC, '128')
    );
    // make sure load successful
    await milvusClient.indexManager.createIndex({
      collection_name: LOAD_COLLECTION_NAME,
      field_name: VECTOR_FIELD_NAME,
      extra_params: {
        index_type: 'IVF_FLAT',
        metric_type: 'L2',
        params: JSON.stringify({ nlist: 1024 }),
      },
    });

    // make sure load successful
    await milvusClient.indexManager.createIndex({
      collection_name: LOAD_COLLECTION_NAME_SYNC,
      field_name: VECTOR_FIELD_NAME,
      extra_params: {
        index_type: 'IVF_FLAT',
        metric_type: 'L2',
        params: JSON.stringify({ nlist: 1024 }),
      },
    });
    // console.log(res);
    expect(res1.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res2.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Has collection should throw error`, async () => {
    try {
      await collectionManager.hasCollection({} as any);
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.COLLECTION_NAME_IS_REQUIRED);
    }
  });

  it(`Has collection should success`, async () => {
    const res = await collectionManager.hasCollection({
      collection_name: COLLECTION_NAME,
    });
    // console.log('----has collection', res);
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res.value).toEqual(true);
  });

  it('Rename collection should be successful ', async () => {
    // rename
    const renameRes = await collectionManager.renameCollection({
      collection_name: COLLECTION_NAME,
      new_collection_name: NEW_COLLECTION_NAME,
    });
    expect(renameRes.error_code).toEqual(ErrorCode.SUCCESS);
    // check new collection should be ok
    const hasRes = await collectionManager.hasCollection({
      collection_name: NEW_COLLECTION_NAME,
    });
    expect(hasRes.status.error_code).toEqual(ErrorCode.SUCCESS);

    // rename back
    const newRenameRes = await collectionManager.renameCollection({
      collection_name: NEW_COLLECTION_NAME,
      new_collection_name: COLLECTION_NAME,
    });
    expect(newRenameRes.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it('Has collection should throw check params error', async () => {
    try {
      await collectionManager.hasCollection({} as any);
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.COLLECTION_NAME_IS_REQUIRED);
    }
  });

  it(`Has collection not exist`, async () => {
    const res = await collectionManager.hasCollection({
      collection_name: 'collection_not_exist',
    });
    expect(res.value).toEqual(false);
  });

  it(`Show all collections`, async () => {
    const res = await collectionManager.showCollections();
    // console.log(res);
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res.data.filter(v => v.name === COLLECTION_NAME).length).toEqual(1);
  });

  it(
    `Expect Show all collections should timeout`,
    timeoutTest(collectionManager.showCollections.bind(collectionManager))
  );

  it(`Get Collection Statistics should throw error`, async () => {
    try {
      await collectionManager.getCollectionStatistics({} as any);
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.COLLECTION_NAME_IS_REQUIRED);
    }
  });

  it(`Get Collection Statistics should success`, async () => {
    const res = await collectionManager.getCollectionStatistics({
      collection_name: COLLECTION_NAME,
    });
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res.stats[0].value).toEqual('0');
    expect(res.data.row_count).toEqual('0');
  });

  it('Describe Collection info', async () => {
    const res = await collectionManager.describeCollection({
      collection_name: COLLECTION_NAME,
    });
    // console.log('---- describe collection ---', res);
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res.consistency_level).toEqual('Eventually');
    expect(res.schema.name).toEqual(COLLECTION_NAME);
    expect(res.schema.fields.length).toEqual(2);
    expect(res.schema.fields[0].name).toEqual(VECTOR_FIELD_NAME);
    expect(res.schema.fields[1].name).toEqual('age');
  });

  it(`Load Collection Sync throw COLLECTION_NAME_IS_REQUIRED`, async () => {
    try {
      await collectionManager.loadCollectionSync({} as any);
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.COLLECTION_NAME_IS_REQUIRED);
    }
  });

  it(`Load Collection Sync success `, async () => {
    const res = await collectionManager.loadCollectionSync({
      collection_name: LOAD_COLLECTION_NAME_SYNC,
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Load Collection Sync with replica no enough node error `, async () => {
    try {
      await collectionManager.releaseCollection({
        collection_name: LOAD_COLLECTION_NAME_SYNC,
      });
      const res = await collectionManager.loadCollectionSync({
        collection_name: LOAD_COLLECTION_NAME_SYNC,
        replica_number: 3,
      });
      expect(res.error_code).not.toEqual(ErrorCode.SUCCESS);
    } catch (error) {
      expect(typeof error.message).toBe('string');
    }
  });

  it(`Load Collection Sync throw error`, async () => {
    const fakeClient = new MilvusClient(IP);

    fakeClient.collectionManager.showCollections = () => {
      return new Promise(res => {
        res({
          status: {
            error_code: 'error',
            reason: '123',
          },
        } as any);
      });
    };
    try {
      await fakeClient.collectionManager.loadCollectionSync({
        collection_name: LOAD_COLLECTION_NAME,
      });
    } catch (error) {
      expect(typeof error.message).toBe('string');
    } finally {
      fakeClient.closeConnection();
    }
  });

  it(`Load Collection Async throw COLLECTION_NAME_IS_REQUIRED`, async () => {
    try {
      await collectionManager.loadCollectionSync({} as any);
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.COLLECTION_NAME_IS_REQUIRED);
    }
  });

  it(`Load Collection Async success`, async () => {
    await collectionManager.releaseCollection({
      collection_name: LOAD_COLLECTION_NAME,
    });
    const res = await collectionManager.loadCollection({
      collection_name: LOAD_COLLECTION_NAME,
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Show loaded collections success`, async () => {
    const res = await collectionManager.showCollections({
      type: ShowCollectionsType.Loaded,
    });

    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it('Compact collection and get state expect success', async () => {
    const res = await collectionManager.compact({
      collection_name: LOAD_COLLECTION_NAME,
    });
    const compactionID = res.compactionID;
    const state = await collectionManager.getCompactionState({ compactionID });
    const stateWithPlan = await collectionManager.getCompactionStateWithPlans({
      compactionID,
    });

    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(state.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(stateWithPlan.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it('Compact collection expect throw error', async () => {
    try {
      await collectionManager.compact({
        collection_name: undefined as any,
      });
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.COLLECTION_NAME_IS_REQUIRED);
    }
  });

  it(`Create alais success`, async () => {
    try {
      await collectionManager.createAlias({
        collection_name: LOAD_COLLECTION_NAME,
        alias: ALIAS,
      });

      const res = await collectionManager.describeCollection({
        collection_name: LOAD_COLLECTION_NAME,
      });

      expect(res.aliases[0]).toEqual(ALIAS);
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.COLLECTION_NAME_IS_REQUIRED);
    }
  });

  it(`Alter alais success`, async () => {
    try {
      await collectionManager.alterAlias({
        collection_name: LOAD_COLLECTION_NAME_SYNC,
        alias: ALIAS,
      });
      const res = await collectionManager.describeCollection({
        collection_name: LOAD_COLLECTION_NAME_SYNC,
      });
      expect(res.aliases[0]).toEqual(ALIAS);
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.COLLECTION_NAME_IS_REQUIRED);
    }
  });

  it(`Drop alais success`, async () => {
    try {
      await collectionManager.dropAlias({
        alias: ALIAS,
      });
      const res = await collectionManager.describeCollection({
        collection_name: LOAD_COLLECTION_NAME,
      });
      const res2 = await collectionManager.describeCollection({
        collection_name: LOAD_COLLECTION_NAME_SYNC,
      });

      expect(res.aliases.length).toEqual(0);
      expect(res2.aliases.length).toEqual(0);
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.COLLECTION_NAME_IS_REQUIRED);
    }
  });

  it('Get Compaction State and with plan throw error', async () => {
    try {
      await collectionManager.getCompactionState({
        compactionID: undefined as any,
      });
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.COMPACTIONID_IS_REQUIRED);
    }

    try {
      await collectionManager.getCompactionStateWithPlans({
        compactionID: undefined as any,
      });
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.COMPACTIONID_IS_REQUIRED);
    }
  });

  it(`Release Collection`, async () => {
    const res = await collectionManager.releaseCollection({
      collection_name: COLLECTION_NAME,
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  // make sure all collections are deleted here
  it(`Drop Collection`, async () => {
    const res = await collectionManager.dropCollection({
      collection_name: COLLECTION_NAME,
    });
    const res2 = await collectionManager.dropCollection({
      collection_name: LOAD_COLLECTION_NAME,
    });
    const res3 = await collectionManager.dropCollection({
      collection_name: LOAD_COLLECTION_NAME_SYNC,
    });
    const res4 = await collectionManager.dropCollection({
      collection_name: TEST_CONSISTENCY_LEVEL_COLLECTION_NAME,
    });
    const res5 = await collectionManager.dropCollection({
      collection_name: 'any',
    });

    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res2.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res3.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res4.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res5.error_code).toEqual(ErrorCode.SUCCESS);
  });
});
