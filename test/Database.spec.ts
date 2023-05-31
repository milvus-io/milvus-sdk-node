import { MilvusClient, ErrorCode, DEFAULT_DB } from '../milvus';
import { IP, genCollectionParams, GENERATE_NAME } from './tools';

let milvusClient = new MilvusClient({ address: IP });
const DB_NAME = GENERATE_NAME('database');
const COLLECTION_NAME = GENERATE_NAME();

describe(`Database API`, () => {
  it(`create database should be ok`, async () => {
    await milvusClient.use({ db_name: DEFAULT_DB });

    const res = await milvusClient.createDatabase({
      db_name: DB_NAME,
    });

    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`using database should be ok`, async () => {
    // use db
    const useDB = await milvusClient.use({ db_name: DB_NAME });
    expect(useDB!.error_code).toEqual(ErrorCode.SUCCESS);

    // create collection on another db
    const create = await milvusClient.createCollection(
      genCollectionParams({ collectionName: COLLECTION_NAME, dim: 4 })
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

  it(`ListDatabases should be ok`, async () => {
    const allDatabases = await milvusClient.listDatabases();
    expect(allDatabases.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(allDatabases.db_names.length).toBeGreaterThan(1);
  });

  it(`drop database should be ok`, async () => {
    const drop = await milvusClient.dropDatabase({ db_name: DB_NAME });
    expect(drop.error_code).toEqual(ErrorCode.SUCCESS);
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
