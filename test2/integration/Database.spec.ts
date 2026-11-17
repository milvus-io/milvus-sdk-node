import { createClient } from '../support/client';
import { expectSuccess } from '../support/assertions';
import {
  MilvusClient,
  ErrorCode,
  DEFAULT_DB,
  formatKeyValueData,
  findKeyValue,
  ListDatabasesResponse,
} from '../../milvus';
import {
  IP,
  collectionSchema,
  GENERATE_NAME,
  generateInsertData,
} from '../fixtures';

let milvusClient = createClient({
  address: IP,
  logLevel: 'info',
  username: process.env.MILVUS_USERNAME || 'root',
  password: process.env.MILVUS_PASSWORD || 'Milvus',
});
const DEFAULT = 'default';
const DB_NAME = GENERATE_NAME('database');
const DB_NAME2 = GENERATE_NAME('database');
const DB_WITH_PROPERTY = GENERATE_NAME();
const COLLECTION_NAME = GENERATE_NAME();
const COLLECTION_NAME2 = GENERATE_NAME();

describe(`Database API`, () => {
  beforeAll(async () => {
    await milvusClient.createDatabase({
      db_name: DB_NAME2,
    });
  });
  afterAll(async () => {
    // drop another db
    await milvusClient.dropDatabase({ db_name: DB_NAME2 });
  });

  it(`create database should be ok`, async () => {
    await milvusClient.use({ db_name: DEFAULT_DB });

    const res = await milvusClient.createDatabase({
      db_name: DB_NAME,
    });

    expectSuccess(res);
  });

  it(`using database should be ok`, async () => {
    // use db
    const useDB = await milvusClient.useDatabase({ db_name: DB_NAME });
    expectSuccess(useDB!);

    // create collection in another db
    const create = await milvusClient.createCollection(
      collectionSchema({ collectionName: COLLECTION_NAME, dim: [4] })
    );
    expectSuccess(create);

    const ShowCollections = await milvusClient.showCollections();
    expect(ShowCollections.data.length).toBeGreaterThan(0);

    // drop collection
    const dropCollections = await milvusClient.dropCollection({
      collection_name: COLLECTION_NAME,
    });

    expectSuccess(dropCollections);
  });

  it(`using database with address should be ok`, async () => {
    // use another client with db
    const newClient = createClient({
      address: IP,
      database: DB_NAME,
      username: process.env.MILVUS_USERNAME || 'root',
      password: process.env.MILVUS_PASSWORD || 'Milvus',
      __SKIP_CONNECT__: true,
    });
    expect(newClient.config.database).toEqual(DB_NAME);
  });

  it(`ListDatabases should be ok`, async () => {
    const allDatabases: ListDatabasesResponse =
      await milvusClient.listDatabases();
    expectSuccess(allDatabases.status);
    expect(allDatabases.db_names.length).toBeGreaterThan(1);
    expect(allDatabases.db_ids.length).toEqual(allDatabases.db_names.length);
    expect(allDatabases.created_timestamp.length).toEqual(
      allDatabases.db_names.length
    );
    expect(typeof allDatabases.db_ids[0]).toEqual('string');
    expect(typeof allDatabases.created_timestamp[0]).toEqual('string');
  });

  it(`describe database should be ok`, async () => {
    const describe = await milvusClient.describeDatabase({ db_name: DB_NAME });
    expect(describe.db_name).toEqual(DB_NAME);
    expect(describe.dbID * 1).toBeGreaterThan(0);
    expect(describe.created_timestamp * 1).toBeGreaterThan(0);
    expect(describe.properties).toEqual([]);
  });

  it(`drop database should be ok`, async () => {
    const drop = await milvusClient.dropDatabase({ db_name: DB_NAME });
    expectSuccess(drop);
  });

  it(`using db_name in API should be ok`, async () => {
    // create collection on another db
    const params = collectionSchema({
      collectionName: COLLECTION_NAME2,
      dim: [4],
    });
    const createCollection = await milvusClient.createCollection({
      ...params,
      db_name: DB_NAME2,
    });
    expectSuccess(createCollection);

    // gen data
    const vectors = generateInsertData(params.fields, 5);

    // insert
    const insert = await milvusClient.insert({
      collection_name: COLLECTION_NAME2,
      db_name: DB_NAME2,
      data: vectors,
    });
    expectSuccess(insert.status);

    // describe collection
    const describeCollection = await milvusClient.describeCollection({
      collection_name: COLLECTION_NAME2,
      db_name: DB_NAME2,
    });
    expect(describeCollection.collection_name).toEqual(COLLECTION_NAME2);

    const describeCollectionInDb = await milvusClient.describeCollection({
      collection_name: COLLECTION_NAME2,
    });
    expect(describeCollectionInDb.status.error_code).toEqual(
      ErrorCode.UnexpectedError
    );

    // alterCollection
    const alterCollection = await milvusClient.alterCollectionProperties({
      collection_name: COLLECTION_NAME2,
      db_name: DB_NAME2,
      properties: { 'collection.segment.rowLimit': 10000 },
    });
    expectSuccess(alterCollection);
    const describeCollectionAfterAlter = await milvusClient.describeCollection({
      collection_name: COLLECTION_NAME2,
      db_name: DB_NAME2,
    });
    expect(describeCollectionAfterAlter.properties).toEqual(
      expect.arrayContaining([
        { key: 'collection.segment.rowLimit', value: '10000' },
        { key: 'timezone', value: 'UTC' },
      ])
    );

    // drop collection properties
    const dropCollectionProperties =
      await milvusClient.dropCollectionProperties({
        collection_name: COLLECTION_NAME2,
        db_name: DB_NAME2,
        properties: ['collection.segment.rowLimit'],
      });
    expectSuccess(dropCollectionProperties);

    const describeCollectionAfterDrop = await milvusClient.describeCollection({
      collection_name: COLLECTION_NAME2,
      db_name: DB_NAME2,
    });
    expect(describeCollectionAfterDrop.properties).toEqual(
      expect.arrayContaining([{ key: 'timezone', value: 'UTC' }])
    );
    expect(
      describeCollectionAfterDrop.properties.some(
        property => property.key === 'collection.segment.rowLimit'
      )
    ).toEqual(false);

    // show collections
    const showCollections = await milvusClient.showCollections({
      db_name: DB_NAME2,
    });
    expect(showCollections.data.length).toBeGreaterThan(0);

    // create partition
    const createPartition = await milvusClient.createPartition({
      collection_name: COLLECTION_NAME2,
      db_name: DB_NAME2,
      partition_name: 'partition1',
    });
    expectSuccess(createPartition);

    // show partitions
    const showPartitions = await milvusClient.showPartitions({
      collection_name: COLLECTION_NAME2,
      db_name: DB_NAME2,
    });
    expect(showPartitions.partition_names).toContain('partition1');

    // getCollectionStatistics
    const getCollectionStatistics = await milvusClient.getCollectionStatistics({
      collection_name: COLLECTION_NAME2,
      db_name: DB_NAME2,
    });
    expectSuccess(getCollectionStatistics.status);

    // create index
    const createIndex = await milvusClient.createIndex({
      collection_name: COLLECTION_NAME2,
      db_name: DB_NAME2,
      field_name: 'vector',
      index_name: 'vector2',
    });
    expectSuccess(createIndex);

    // alter index
    const alterIndex = await milvusClient.alterIndexProperties({
      collection_name: COLLECTION_NAME2,
      db_name: DB_NAME2,
      index_name: 'vector2',
      params: { 'mmap.enabled': true },
    });
    expectSuccess(alterIndex);

    // describe index
    const describeIndex = await milvusClient.describeIndex({
      collection_name: COLLECTION_NAME2,
      db_name: DB_NAME2,
      index_name: 'vector2',
    });
    expect(describeIndex.index_descriptions[0].index_name).toEqual('vector2');
    const p1 = describeIndex.index_descriptions[0].params;
    expect(findKeyValue(p1, 'mmap.enabled')).toEqual('true');

    // drop index properties
    const dropIndexProperties = await milvusClient.dropIndexProperties({
      collection_name: COLLECTION_NAME2,
      db_name: DB_NAME2,
      index_name: 'vector2',
      properties: ['mmap.enabled'],
    });
    expectSuccess(dropIndexProperties);

    // describe index
    const describeIndexAfterDrop = await milvusClient.describeIndex({
      collection_name: COLLECTION_NAME2,
      db_name: DB_NAME2,
      index_name: 'vector2',
    });
    const p2 = describeIndexAfterDrop.index_descriptions[0].params;
    expect(findKeyValue(p2, 'mmap.enabled')).toEqual(undefined);

    // load collection
    const loadCollection = await milvusClient.loadCollection({
      collection_name: COLLECTION_NAME2,
      db_name: DB_NAME2,
    });
    expectSuccess(loadCollection);

    // query
    const query = await milvusClient.count({
      collection_name: COLLECTION_NAME2,
      db_name: DB_NAME2,
    });
    expectSuccess(query.status);

    // search
    const search = await milvusClient.search({
      collection_name: COLLECTION_NAME2,
      db_name: DB_NAME2,
      data: [1, 2, 3, 4],
    });
    expectSuccess(search.status);

    // release collection
    const releaseCollection = await milvusClient.releaseCollection({
      collection_name: COLLECTION_NAME2,
      db_name: DB_NAME2,
    });
    expectSuccess(releaseCollection);

    // addCollectionField with db_name
    const addField = await milvusClient.addCollectionField({
      collection_name: COLLECTION_NAME2,
      db_name: DB_NAME2,
      field: {
        name: 'new_field_single',
        data_type: 'VarChar',
        max_length: 128,
        nullable: true,
      },
    });
    expectSuccess(addField);

    // addCollectionFields (plural) with db_name
    const addFields = await milvusClient.addCollectionFields({
      collection_name: COLLECTION_NAME2,
      db_name: DB_NAME2,
      fields: [
        {
          name: 'new_field_batch_1',
          data_type: 'VarChar',
          max_length: 128,
          nullable: true,
        },
        {
          name: 'new_field_batch_2',
          data_type: 'Int64',
          nullable: true,
        },
      ],
    });
    expectSuccess(addFields);

    // verify the new fields exist in the correct database
    const descAfterAdd = await milvusClient.describeCollection({
      collection_name: COLLECTION_NAME2,
      db_name: DB_NAME2,
    });
    const fieldNames = descAfterAdd.schema.fields.map(
      (f: { name: string }) => f.name
    );
    expect(fieldNames).toContain('new_field_single');
    expect(fieldNames).toContain('new_field_batch_1');
    expect(fieldNames).toContain('new_field_batch_2');

    // drop collection
    const dropCollections = await milvusClient.dropCollection({
      collection_name: COLLECTION_NAME2,
      db_name: DB_NAME2,
    });
    expectSuccess(dropCollections);
  });

  it(`move one collection to aonther database should ok`, async () => {
    // create collection in another db
    const createCollection = await milvusClient.createCollection({
      ...collectionSchema({ collectionName: COLLECTION_NAME2, dim: [4] }),
      db_name: DB_NAME2,
    });
    expectSuccess(createCollection);

    // move colleciton to DEFAULT
    const move = await milvusClient.renameCollection({
      collection_name: COLLECTION_NAME2,
      new_collection_name: COLLECTION_NAME2,
      db_name: DB_NAME2,
      new_db_name: DEFAULT,
    });

    const has = await milvusClient.hasCollection({
      collection_name: COLLECTION_NAME2,
      db_name: DEFAULT,
    });

    expect(has.value).toEqual(true);

    // drop collection
    const dropCollections = await milvusClient.dropCollection({
      collection_name: COLLECTION_NAME2,
      db_name: DEFAULT,
    });
    expectSuccess(dropCollections);
  });

  it(`alter database should be ok`, async () => {
    const alter = await milvusClient.alterDatabase({
      db_name: DB_NAME2,
      properties: { 'database.diskQuota.mb': 2048 },
    });
    expectSuccess(alter);

    const describe = await milvusClient.describeDatabase({
      db_name: DB_NAME2,
    });
    expect(describe.properties).toEqual([
      { key: 'database.diskQuota.mb', value: '2048' },
    ]);

    const alterById = await milvusClient.alterDatabase({
      db_name: DB_NAME2,
      db_id: String(describe.dbID),
      properties: { 'database.diskQuota.mb': 4096 },
    });
    expectSuccess(alterById);

    const describeAfterAlterById = await milvusClient.describeDatabase({
      db_name: DB_NAME2,
    });
    expect(describeAfterAlterById.properties).toEqual([
      { key: 'database.diskQuota.mb', value: '4096' },
    ]);
  });

  it(`drop database properties should be ok`, async () => {
    const drop = await milvusClient.dropDatabaseProperties({
      db_name: DB_NAME2,
      properties: ['database.diskQuota.mb'],
    });
    expectSuccess(drop);

    const describe = await milvusClient.describeDatabase({
      db_name: DB_NAME2,
    });
    expect(describe.properties).toEqual([]);
  });

  it(`create db with property set should be successful`, async () => {
    try {
      const res = await milvusClient.createDatabase({
        db_name: DB_WITH_PROPERTY,
        properties: {
          'replicate.id': 'local-mac',
        },
      });
      expectSuccess(res);

      const describe = await milvusClient.describeDatabase({
        db_name: DB_WITH_PROPERTY,
      });

      expect(
        String(
          formatKeyValueData(describe.properties, ['replicate.id'])[
            'replicate.id'
          ]
        )
      ).toEqual('local-mac');
    } finally {
      await milvusClient.dropDatabase({
        db_name: DB_WITH_PROPERTY,
      });
    }
  });

  // it(`drop database should be ok`, async () => {
  //   const all = await milvusClient.listDatabases();

  //   for (let i = 0; i < all.db_names.length; i++) {
  //     if (all.db_names[i] !== DEFAULT_DB) {
  //       const drop = await milvusClient.dropDatabase({
  //         db_name: all.db_names[i],
  //       });
  //       expect(drop.error_code).toEqual(ErrorCode.SUCCESS);
  //     }
  //   }

  //   const allAfter = await milvusClient.listDatabases();
  //   expect(allAfter.db_names.length).toEqual(1);
  // });
});
