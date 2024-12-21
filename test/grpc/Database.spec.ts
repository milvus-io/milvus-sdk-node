import {
  MilvusClient,
  ErrorCode,
  DEFAULT_DB,
  formatKeyValueData,
  findKeyValue,
} from '../../milvus';
import {
  IP,
  genCollectionParams,
  GENERATE_NAME,
  generateInsertData,
} from '../tools';

let milvusClient = new MilvusClient({ address: IP, logLevel: 'info' });
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

    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`using database should be ok`, async () => {
    // use db
    const useDB = await milvusClient.useDatabase({ db_name: DB_NAME });
    expect(useDB!.error_code).toEqual(ErrorCode.SUCCESS);

    // create collection in another db
    const create = await milvusClient.createCollection(
      genCollectionParams({ collectionName: COLLECTION_NAME, dim: [4] })
    );
    expect(create.error_code).toEqual(ErrorCode.SUCCESS);

    const ShowCollections = await milvusClient.showCollections();
    expect(ShowCollections.data.length).toBeGreaterThan(0);

    // drop collection
    const dropCollections = await milvusClient.dropCollection({
      collection_name: COLLECTION_NAME,
    });

    expect(dropCollections.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`using database with address should be ok`, async () => {
    // use another client with db
    const newClient = new MilvusClient({ address: IP, database: DB_NAME });
    expect(newClient.config.database).toEqual(DB_NAME);
  });

  it(`ListDatabases should be ok`, async () => {
    const allDatabases = await milvusClient.listDatabases();
    expect(allDatabases.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(allDatabases.db_names.length).toBeGreaterThan(1);
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
    expect(drop.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`using db_name in API should be ok`, async () => {
    // create collection on another db
    const params = genCollectionParams({
      collectionName: COLLECTION_NAME2,
      dim: [4],
    });
    const createCollection = await milvusClient.createCollection({
      ...params,
      db_name: DB_NAME2,
    });
    expect(createCollection.error_code).toEqual(ErrorCode.SUCCESS);

    // gen data
    const vectors = generateInsertData(params.fields, 5);

    // insert
    const insert = await milvusClient.insert({
      collection_name: COLLECTION_NAME2,
      db_name: DB_NAME2,
      data: vectors,
    });
    expect(insert.status.error_code).toEqual(ErrorCode.SUCCESS);

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
    expect(alterCollection.error_code).toEqual(ErrorCode.SUCCESS);
    const describeCollectionAfterAlter = await milvusClient.describeCollection({
      collection_name: COLLECTION_NAME2,
      db_name: DB_NAME2,
    });
    expect(describeCollectionAfterAlter.properties).toEqual([
      { key: 'collection.segment.rowLimit', value: '10000' },
    ]);

    // drop collection properties
    const dropCollectionProperties =
      await milvusClient.dropCollectionProperties({
        collection_name: COLLECTION_NAME2,
        db_name: DB_NAME2,
        properties: ['collection.segment.rowLimit'],
      });
    expect(dropCollectionProperties.error_code).toEqual(ErrorCode.SUCCESS);

    const describeCollectionAfterDrop = await milvusClient.describeCollection({
      collection_name: COLLECTION_NAME2,
      db_name: DB_NAME2,
    });
    expect(describeCollectionAfterDrop.properties).toEqual([]);

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
    expect(createPartition.error_code).toEqual(ErrorCode.SUCCESS);

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
    expect(getCollectionStatistics.status.error_code).toEqual(
      ErrorCode.SUCCESS
    );

    // create index
    const createIndex = await milvusClient.createIndex({
      collection_name: COLLECTION_NAME2,
      db_name: DB_NAME2,
      field_name: 'vector',
      index_name: 'vector2',
    });
    expect(createIndex.error_code).toEqual(ErrorCode.SUCCESS);

    // alter index
    const alterIndex = await milvusClient.alterIndexProperties({
      collection_name: COLLECTION_NAME2,
      db_name: DB_NAME2,
      index_name: 'vector2',
      params: { 'mmap.enabled': true },
    });
    expect(alterIndex.error_code).toEqual(ErrorCode.SUCCESS);

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
    expect(dropIndexProperties.error_code).toEqual(ErrorCode.SUCCESS);

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
    expect(loadCollection.error_code).toEqual(ErrorCode.SUCCESS);

    // query
    const query = await milvusClient.count({
      collection_name: COLLECTION_NAME2,
      db_name: DB_NAME2,
    });
    expect(query.status.error_code).toEqual(ErrorCode.SUCCESS);

    // search
    const search = await milvusClient.search({
      collection_name: COLLECTION_NAME2,
      db_name: DB_NAME2,
      data: [1, 2, 3, 4],
    });
    expect(search.status.error_code).toEqual(ErrorCode.SUCCESS);

    // release collection
    const releaseCollection = await milvusClient.releaseCollection({
      collection_name: COLLECTION_NAME2,
      db_name: DB_NAME2,
    });
    expect(releaseCollection.error_code).toEqual(ErrorCode.SUCCESS);

    // drop collection
    const dropCollections = await milvusClient.dropCollection({
      collection_name: COLLECTION_NAME2,
      db_name: DB_NAME2,
    });
    expect(dropCollections.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`move one collection to aonther database should ok`, async () => {
    // create collection in another db
    const createCollection = await milvusClient.createCollection({
      ...genCollectionParams({ collectionName: COLLECTION_NAME2, dim: [4] }),
      db_name: DB_NAME2,
    });
    expect(createCollection.error_code).toEqual(ErrorCode.SUCCESS);

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
    expect(dropCollections.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`alter database should be ok`, async () => {
    const alter = await milvusClient.alterDatabase({
      db_name: DB_NAME2,
      properties: { 'database.diskQuota.mb': 2048 },
    });
    expect(alter.error_code).toEqual(ErrorCode.SUCCESS);

    const describe = await milvusClient.describeDatabase({
      db_name: DB_NAME2,
    });
    expect(describe.properties).toEqual([
      { key: 'database.diskQuota.mb', value: '2048' },
    ]);
  });

  it(`drop database properties should be ok`, async () => {
    const drop = await milvusClient.dropDatabaseProperties({
      db_name: DB_NAME2,
      properties: ['database.diskQuota.mb'],
    });
    expect(drop.error_code).toEqual(ErrorCode.SUCCESS);

    const describe = await milvusClient.describeDatabase({
      db_name: DB_NAME2,
    });
    expect(describe.properties).toEqual([]);
  });

  it(`create db with property set should be successful`, async () => {
    const res = await milvusClient.createDatabase({
      db_name: DB_WITH_PROPERTY,
      properties: {
        'replicate.id': 'local-mac',
      },
    });
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);

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

    // drop collection
    await milvusClient.dropDatabase({
      db_name: DB_WITH_PROPERTY,
    });
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
