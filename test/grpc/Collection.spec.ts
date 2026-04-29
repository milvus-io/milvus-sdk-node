import {
  MilvusClient,
  DataType,
  ErrorCode,
  ShowCollectionsType,
  ERROR_REASONS,
  LoadState,
  formatKeyValueData,
  CollectionProperties,
  IndexType,
  MetricType,
} from '../../milvus';
import {
  IP,
  genCollectionParams,
  VECTOR_FIELD_NAME,
  GENERATE_NAME,
} from '../tools';
import { timeoutTest } from '../tools';

const milvusClient = new MilvusClient({ address: IP, logLevel: 'info' });
const COLLECTION_NAME = GENERATE_NAME();
const NUMBER_DIM_COLLECTION_NAME = GENERATE_NAME();
const NEW_COLLECTION_NAME = GENERATE_NAME();
const TEST_CONSISTENCY_LEVEL_COLLECTION_NAME = GENERATE_NAME();
const LOAD_COLLECTION_NAME = GENERATE_NAME();
const LOAD_COLLECTION_NAME_SYNC = GENERATE_NAME();
const COLLECTION_WITH_PROPERTY = GENERATE_NAME();
const COLLECTION_WITH_ENTITY_TTL = GENERATE_NAME();
const COLLECTION_ENTITY_TTL_ALTER = GENERATE_NAME();
const NON_EXISTENT_COLLECTION_NAME = 'none_existent';

const dbParam = {
  db_name: 'Collection',
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const addCollectionFieldAndWait = async (
  collectionName: string,
  field: { name: string; data_type: DataType; nullable?: boolean }
) => {
  let res = await milvusClient.addCollectionField({
    collection_name: collectionName,
    field,
  });

  for (let i = 0; i < 10; i++) {
    if (res.error_code === ErrorCode.SUCCESS) {
      return res;
    }

    const describe = await milvusClient.describeCollection({
      collection_name: collectionName,
    });
    if (describe.schema.fields.some(f => f.name === field.name)) {
      return { error_code: ErrorCode.SUCCESS, reason: '' };
    }

    await sleep(1000);
    res = await milvusClient.addCollectionField({
      collection_name: collectionName,
      field,
    });
  }

  return res;
};

const COLLECTION_NAME_PARAMS = genCollectionParams({
  collectionName: COLLECTION_NAME,
  dim: [128],
});

describe(`Collection API`, () => {
  beforeAll(async () => {
    await milvusClient.createDatabase(dbParam);
    await milvusClient.use(dbParam);
  });

  afterAll(async () => {
    await milvusClient.dropDatabase(dbParam);
  });
  it(`Create Collection Successful`, async () => {
    const res = await milvusClient.createCollection({
      ...COLLECTION_NAME_PARAMS,
      consistency_level: 'Eventually',
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Create Collection with property set should be successful`, async () => {
    const res = await milvusClient.createCollection({
      ...genCollectionParams({
        collectionName: COLLECTION_WITH_PROPERTY,
        dim: [128],
      }),
      properties: {
        'collection.ttl.seconds': 1000,
        'mmap.enabled': true,
      },
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);

    const describe = await milvusClient.describeCollection({
      collection_name: COLLECTION_WITH_PROPERTY,
    });

    expect(
      Number(
        formatKeyValueData(describe.properties, ['collection.ttl.seconds'])[
          'collection.ttl.seconds'
        ]
      )
    ).toEqual(1000);

    expect(
      Boolean(
        formatKeyValueData(describe.properties, ['mmap.enabled'])[
          'mmap.enabled'
        ]
      )
    ).toEqual(true);
  });

  it(`Drop Collection properties should be successful`, async () => {
    const dropRes = await milvusClient.dropCollectionProperties({
      collection_name: COLLECTION_WITH_PROPERTY,
      properties: [CollectionProperties.TTL_SECONDS],
    });

    expect(dropRes.error_code).toEqual(ErrorCode.SUCCESS);

    const describe = await milvusClient.describeCollection({
      collection_name: COLLECTION_WITH_PROPERTY,
    });

    expect(
      formatKeyValueData(describe.properties, [
        CollectionProperties.TTL_SECONDS,
      ])[CollectionProperties.TTL_SECONDS]
    ).toBeUndefined();

    // drop collection
    await milvusClient.dropCollection({
      collection_name: COLLECTION_WITH_PROPERTY,
    });
  });

  it(`Create Collection with entity-level TTL should be successful`, async () => {
    const res = await milvusClient.createCollection({
      collection_name: COLLECTION_WITH_ENTITY_TTL,
      fields: [
        {
          name: 'id',
          data_type: DataType.Int64,
          is_primary_key: true,
          autoID: false,
        },
        {
          name: 'ttl',
          data_type: DataType.Timestamptz,
          nullable: true,
        },
        {
          name: VECTOR_FIELD_NAME,
          data_type: DataType.FloatVector,
          dim: 4,
        },
      ],
      properties: {
        [CollectionProperties.TTL_FIELD]: 'ttl',
      },
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);

    const describe = await milvusClient.describeCollection({
      collection_name: COLLECTION_WITH_ENTITY_TTL,
    });

    expect(
      formatKeyValueData(describe.properties, [CollectionProperties.TTL_FIELD])[
        CollectionProperties.TTL_FIELD
      ]
    ).toEqual('ttl');

    const ttlField = describe.schema.fields.find(field => field.name === 'ttl');
    expect(ttlField?.dataType).toEqual(DataType.Timestamptz);
    expect(ttlField?.nullable).toEqual(true);

    const insert = await milvusClient.insert({
      collection_name: COLLECTION_WITH_ENTITY_TTL,
      data: [
        {
          id: 1,
          ttl: null,
          [VECTOR_FIELD_NAME]: [0.1, 0.2, 0.3, 0.4],
        },
        {
          id: 2,
          ttl: '2099-12-31T00:00:00Z',
          [VECTOR_FIELD_NAME]: [0.2, 0.3, 0.4, 0.5],
        },
      ],
    });
    expect(insert.status.error_code).toEqual(ErrorCode.SUCCESS);

    const flush = await milvusClient.flushSync({
      collection_names: [COLLECTION_WITH_ENTITY_TTL],
    });
    expect(flush.status.error_code).toEqual(ErrorCode.SUCCESS);

    const createIndex = await milvusClient.createIndex({
      collection_name: COLLECTION_WITH_ENTITY_TTL,
      field_name: VECTOR_FIELD_NAME,
      index_type: IndexType.AUTOINDEX,
      metric_type: MetricType.L2,
    });
    expect(createIndex.error_code).toEqual(ErrorCode.SUCCESS);

    const load = await milvusClient.loadCollectionSync({
      collection_name: COLLECTION_WITH_ENTITY_TTL,
    });
    expect(load.error_code).toEqual(ErrorCode.SUCCESS);

    const query = await milvusClient.query({
      collection_name: COLLECTION_WITH_ENTITY_TTL,
      filter: 'id in [1, 2]',
      output_fields: ['id', 'ttl'],
      limit: 10,
    });
    expect(query.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(query.data.length).toEqual(2);

    await milvusClient.dropCollection({
      collection_name: COLLECTION_WITH_ENTITY_TTL,
    });
  });

  it(`Alter Collection entity-level TTL property should be successful`, async () => {
    const create = await milvusClient.createCollection({
      collection_name: COLLECTION_ENTITY_TTL_ALTER,
      fields: [
        {
          name: 'id',
          data_type: DataType.Int64,
          is_primary_key: true,
          autoID: false,
        },
        {
          name: VECTOR_FIELD_NAME,
          data_type: DataType.FloatVector,
          dim: 4,
        },
      ],
    });
    expect(create.error_code).toEqual(ErrorCode.SUCCESS);

    const addField = await addCollectionFieldAndWait(
      COLLECTION_ENTITY_TTL_ALTER,
      {
        name: 'ttl',
        data_type: DataType.Timestamptz,
        nullable: true,
      }
    );
    expect(addField.error_code).toEqual(ErrorCode.SUCCESS);

    const alter = await milvusClient.alterCollectionProperties({
      collection_name: COLLECTION_ENTITY_TTL_ALTER,
      properties: {
        [CollectionProperties.TTL_FIELD]: 'ttl',
      },
    });
    expect(alter.error_code).toEqual(ErrorCode.SUCCESS);

    const describe = await milvusClient.describeCollection({
      collection_name: COLLECTION_ENTITY_TTL_ALTER,
    });
    expect(
      formatKeyValueData(describe.properties, [CollectionProperties.TTL_FIELD])[
        CollectionProperties.TTL_FIELD
      ]
    ).toEqual('ttl');

    const drop = await milvusClient.dropCollectionProperties({
      collection_name: COLLECTION_ENTITY_TTL_ALTER,
      properties: [CollectionProperties.TTL_FIELD],
    });
    expect(drop.error_code).toEqual(ErrorCode.SUCCESS);

    const describeAfterDrop = await milvusClient.describeCollection({
      collection_name: COLLECTION_ENTITY_TTL_ALTER,
    });
    expect(
      formatKeyValueData(describeAfterDrop.properties, [
        CollectionProperties.TTL_FIELD,
      ])[CollectionProperties.TTL_FIELD]
    ).toBeUndefined();

    await milvusClient.dropCollection({
      collection_name: COLLECTION_ENTITY_TTL_ALTER,
    });
  });

  it(`Should get pk fieldname successfully`, async () => {
    const res = await milvusClient.getPkFieldName({
      collection_name: COLLECTION_NAME,
    });
    expect(res).toEqual('id');
  });

  it(`Create Collection with number dim Successful`, async () => {
    const res = await milvusClient.createCollection({
      ...genCollectionParams({
        collectionName: NUMBER_DIM_COLLECTION_NAME,
        dim: [128],
      }),
      consistency_level: 'Eventually',
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Create Collection validate fields`, async () => {
    try {
      await milvusClient.createCollection({
        collection_name: 'zxc',
      } as any);
    } catch (error) {
      expect(error.message).toEqual(
        ERROR_REASONS.CREATE_COLLECTION_CHECK_MISS_DIM
      );
    }
    try {
      await milvusClient.createCollection({
        collection_name: 'zxc',
        fields: [
          {
            name: 'vector_01',
            description: 'vector field',
            data_type: DataType.FloatVector,
            dim: 128,
          },
        ],
      });
    } catch (error) {
      expect(error.message).toEqual(
        ERROR_REASONS.CREATE_COLLECTION_CHECK_PRIMARY_KEY
      );
    }

    try {
      await milvusClient.createCollection({
        collection_name: 'zxc',
        fields: [
          {
            name: 'id',
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
      await milvusClient.createCollection({
        collection_name: 'zxc',
        fields: [
          {
            name: 'vector_01',
            description: 'vector field',
            data_type: DataType.FloatVector,
          },
          {
            name: 'id',
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
      const d = await milvusClient.createCollection(
        genCollectionParams({ collectionName: 'any', dim: [10] })
      );
    } catch (error) {
      expect(error.message).toEqual(
        ERROR_REASONS.CREATE_COLLECTION_CHECK_BINARY_DIM
      );
    }
  });

  it(`Create collection should throw CREATE_COLLECTION_CHECK_BINARY_DIM`, async () => {
    try {
      await milvusClient.createCollection({
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
            name: 'id',
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

  it(`Create collection should throw check params error`, async () => {
    try {
      await milvusClient.createCollection({} as any);
    } catch (error) {
      expect(error.message).toEqual(
        ERROR_REASONS.CREATE_COLLECTION_CHECK_PARAMS
      );
    }
  });

  it(`Create collection will be successful even if passed consistency level is invalid`, async () => {
    const res = await milvusClient.createCollection({
      ...genCollectionParams({
        collectionName: TEST_CONSISTENCY_LEVEL_COLLECTION_NAME,
        dim: [128],
      }),
      consistency_level: 'xxx' as any,
    });

    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Create load Collection Successful`, async () => {
    const res1 = await milvusClient.createCollection(
      genCollectionParams({ collectionName: LOAD_COLLECTION_NAME, dim: [128] })
    );
    const res2 = await milvusClient.createCollection(
      genCollectionParams({
        collectionName: LOAD_COLLECTION_NAME_SYNC,
        dim: [128],
      })
    );
    // make sure load successful
    await milvusClient.createIndex({
      collection_name: LOAD_COLLECTION_NAME,
      field_name: VECTOR_FIELD_NAME,
      extra_params: {
        index_type: 'IVF_FLAT',
        metric_type: 'L2',
        params: JSON.stringify({ nlist: 1024 }),
      },
    });

    // make sure load successful
    await milvusClient.createIndex({
      collection_name: LOAD_COLLECTION_NAME_SYNC,
      field_name: VECTOR_FIELD_NAME,
      extra_params: {
        index_type: 'IVF_FLAT',
        metric_type: 'L2',
        params: JSON.stringify({ nlist: 1024 }),
      },
    });
    expect(res1.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res2.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Has collection should success`, async () => {
    const res = await milvusClient.hasCollection({
      collection_name: COLLECTION_NAME,
    });
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res.value).toEqual(true);
  });

  it(`Has collection should get false`, async () => {
    const res = await milvusClient.hasCollection({
      collection_name: NON_EXISTENT_COLLECTION_NAME,
    });
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res.value).toEqual(false);
  });

  it('Rename collection should be successful ', async () => {
    // rename
    const renameRes = await milvusClient.renameCollection({
      collection_name: COLLECTION_NAME,
      new_collection_name: NEW_COLLECTION_NAME,
    });
    expect(renameRes.error_code).toEqual(ErrorCode.SUCCESS);
    // check new collection should be ok
    const hasRes = await milvusClient.hasCollection({
      collection_name: NEW_COLLECTION_NAME,
    });
    expect(hasRes.status.error_code).toEqual(ErrorCode.SUCCESS);

    // rename back
    const newRenameRes = await milvusClient.renameCollection({
      collection_name: NEW_COLLECTION_NAME,
      new_collection_name: COLLECTION_NAME,
    });
    expect(newRenameRes.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it('Has collection should throw check params error', async () => {
    try {
      await milvusClient.hasCollection({} as any);
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.COLLECTION_NAME_IS_REQUIRED);
    }
  });

  it(`Has collection not exist`, async () => {
    const res = await milvusClient.hasCollection({
      collection_name: 'collection_not_exist',
    });
    expect(res.value).toEqual(false);
  });

  it(`Show all collections`, async () => {
    const res = await milvusClient.showCollections();
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res.data.filter(v => v.name === COLLECTION_NAME).length).toEqual(1);

    const res2 = await milvusClient.list_collections();
    expect(res2.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res2.data.filter(v => v.name === COLLECTION_NAME).length).toEqual(1);
  });

  it(
    `Expect Show all collections should timeout`,
    timeoutTest(milvusClient.showCollections.bind(milvusClient))
  );

  it(`Get Collection Statistics should throw error`, async () => {
    try {
      await milvusClient.getCollectionStatistics({} as any);
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.COLLECTION_NAME_IS_REQUIRED);
    }
  });

  it(`Get Collection Statistics should success`, async () => {
    const res = await milvusClient.getCollectionStatistics({
      collection_name: COLLECTION_NAME,
    });
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res.stats[0].value).toEqual('0');
    expect(res.data.row_count).toEqual('0');

    // alias
    const alias = await milvusClient.getCollectionStats({
      collection_name: COLLECTION_NAME,
    });
    expect(alias.stats[0].value).toEqual(res.stats[0].value);
    expect(alias.data.row_count).toEqual(res.data.row_count);
  });

  it(`Describe Collection info`, async () => {
    const res = await milvusClient.describeCollection({
      collection_name: COLLECTION_NAME,
    });
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res.consistency_level).toEqual('Eventually');
    expect(res.schema.name).toEqual(COLLECTION_NAME);
    expect(res.schema.fields.length).toEqual(
      COLLECTION_NAME_PARAMS.fields.length
    );
    res.schema.fields.forEach(f => {
      expect(typeof f.dataType).toEqual('number');
      expect(typeof f.data_type).toEqual('string');
    });
    expect(res.schema.fields[0].name).toEqual(VECTOR_FIELD_NAME);
    expect(res.schema.fields[1].name).toEqual('id');
  });

  it(`alter collection success`, async () => {
    const key = 'collection.ttl.seconds';
    const value = 18000;

    const alter = await milvusClient.alterCollectionProperties({
      collection_name: LOAD_COLLECTION_NAME,
      properties: { [key]: value },
    });
    expect(alter.error_code).toEqual(ErrorCode.SUCCESS);

    const key2 = 'mmap.enabled';
    const value2 = true;

    const alter2 = await milvusClient.alterCollectionProperties({
      collection_name: LOAD_COLLECTION_NAME,
      properties: { [key2]: value2 },
    });

    expect(alter2.error_code).toEqual(ErrorCode.SUCCESS);
    const describe = await milvusClient.describeCollection({
      collection_name: LOAD_COLLECTION_NAME,
    });

    expect(Number(formatKeyValueData(describe.properties, [key])[key])).toEqual(
      value
    );

    expect(
      Boolean(formatKeyValueData(describe.properties, [key2])[key2])
    ).toEqual(value2);
  });

  it(`Alter collection field properties should success`, async () => {
    const key = 'mmap.enabled';
    const value = true;

    const alter = await milvusClient.alterCollectionFieldProperties({
      collection_name: LOAD_COLLECTION_NAME,
      field_name: 'json',
      properties: { [key]: value },
      db_name: 'Collection', // pass test case
    });

    expect(alter.error_code).toEqual(ErrorCode.SUCCESS);

    const describe = await milvusClient.describeCollection({
      collection_name: LOAD_COLLECTION_NAME,
    });

    // find json field
    const jsonField = describe.schema.fields.find(
      f => f.name === 'json'
    ) as any;
    expect(jsonField['mmap.enabled']).toEqual('true');

    const alter2 = await milvusClient.alterCollectionFieldProperties({
      collection_name: LOAD_COLLECTION_NAME,
      field_name: 'varChar',
      properties: { max_length: 1024 },
      db_name: 'Collection', // pass test case
    });
    expect(alter2.error_code).toEqual(ErrorCode.SUCCESS);

    const describe2 = await milvusClient.describeCollection({
      collection_name: LOAD_COLLECTION_NAME,
    });

    // find varChar field
    const varCharField = describe2.schema.fields.find(
      f => f.name === 'varChar'
    ) as any;

    expect(varCharField['max_length']).toEqual('1024');
  });

  it(`Load Collection Sync throw COLLECTION_NAME_IS_REQUIRED`, async () => {
    try {
      await milvusClient.loadCollectionSync({} as any);
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.COLLECTION_NAME_IS_REQUIRED);
    }
  });

  it(`Load Collection Sync success `, async () => {
    const res = await milvusClient.loadCollectionSync({
      collection_name: LOAD_COLLECTION_NAME_SYNC,
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Get load loading progress throw COLLECTION_NAME_IS_REQUIRED`, async () => {
    try {
      await milvusClient.getLoadingProgress({} as any);
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.COLLECTION_NAME_IS_REQUIRED);
    }
  });

  it(`Get loading progress success`, async () => {
    const res = await milvusClient.getLoadingProgress({
      collection_name: LOAD_COLLECTION_NAME_SYNC,
    });
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(typeof res.progress).toEqual('string'); // int64 in node is string
  });

  it(`refresh load on LOAD_COLLECTION_NAME_SYNC c should success`, async () => {
    const res = await milvusClient.refreshLoad({
      collection_name: LOAD_COLLECTION_NAME_SYNC,
      db_name: 'Collection',
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Get load state throw COLLECTION_NAME_IS_REQUIRED`, async () => {
    try {
      await milvusClient.getLoadState({} as any);
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.COLLECTION_NAME_IS_REQUIRED);
    }
  });

  it(`Get load state success`, async () => {
    const res = await milvusClient.getLoadState({
      collection_name: LOAD_COLLECTION_NAME_SYNC,
    });
    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(Object.values(LoadState).includes(res.state));
  });

  it(`Load Collection Sync with replica no enough node error `, async () => {
    try {
      await milvusClient.releaseCollection({
        collection_name: LOAD_COLLECTION_NAME_SYNC,
      });
      const res = await milvusClient.loadCollectionSync({
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

    fakeClient.showCollections = () => {
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
      await fakeClient.loadCollectionSync({
        collection_name: LOAD_COLLECTION_NAME,
      });
    } catch (error) {
      expect(typeof error.message).toBe('string');
    } finally {
      fakeClient.closeConnection();
    }
  });

  it(`Load Collection Sync throw error from getLoadingProgress`, async () => {
    const fakeClient = new MilvusClient(IP);

    fakeClient.getLoadingProgress = () => {
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
      await fakeClient.loadCollectionSync({
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
      await milvusClient.loadCollectionSync({} as any);
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.COLLECTION_NAME_IS_REQUIRED);
    }
  });

  it(`Load Collection Async success`, async () => {
    await milvusClient.releaseCollection({
      collection_name: LOAD_COLLECTION_NAME,
    });
    const res = await milvusClient.loadCollectionAsync({
      collection_name: LOAD_COLLECTION_NAME,
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Show loaded collections success`, async () => {
    const res = await milvusClient.showCollections({
      type: ShowCollectionsType.Loaded,
    });

    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it('Compact collection and get state expect success', async () => {
    const res = await milvusClient.compact({
      collection_name: LOAD_COLLECTION_NAME,
    });
    const compactionID = res.compactionID;
    const state = await milvusClient.getCompactionState({ compactionID });
    const stateWithPlan = await milvusClient.getCompactionStateWithPlans({
      compactionID,
    });

    expect(res.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(state.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(stateWithPlan.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`Compact collection expect throw error`, async () => {
    try {
      await milvusClient.compact({
        collection_name: undefined as any,
      });
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.COLLECTION_NAME_IS_REQUIRED);
    }
  });

  it(`Get Compaction State and with plan throw error`, async () => {
    try {
      await milvusClient.getCompactionState({
        compactionID: undefined as any,
      });
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.COMPACTION_ID_IS_REQUIRED);
    }

    try {
      await milvusClient.getCompactionStateWithPlans({
        compactionID: undefined as any,
      });
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.COMPACTION_ID_IS_REQUIRED);
    }
  });

  it(`Release Collection`, async () => {
    const res = await milvusClient.releaseCollection({
      collection_name: COLLECTION_NAME,
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  // make sure all collections are deleted here
  it(`Drop Collection`, async () => {
    const res = await milvusClient.dropCollection({
      collection_name: COLLECTION_NAME,
    });
    const res2 = await milvusClient.dropCollection({
      collection_name: LOAD_COLLECTION_NAME,
    });
    const res3 = await milvusClient.dropCollection({
      collection_name: LOAD_COLLECTION_NAME_SYNC,
    });
    const res4 = await milvusClient.dropCollection({
      collection_name: TEST_CONSISTENCY_LEVEL_COLLECTION_NAME,
    });
    const res5 = await milvusClient.dropCollection({
      collection_name: 'any',
    });
    const res6 = await milvusClient.dropCollection({
      collection_name: NUMBER_DIM_COLLECTION_NAME,
    });

    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res2.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res3.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res4.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res5.error_code).toEqual(ErrorCode.SUCCESS);
    expect(res6.error_code).toEqual(ErrorCode.SUCCESS);
  });
});
