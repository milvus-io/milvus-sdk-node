import { MilvusClient, ErrorCode } from '../milvus';
import { IP, genCollectionParams, GENERATE_NAME } from './tools';

let milvusClient = new MilvusClient({ address: IP });
const DB_NAME = GENERATE_NAME();
const COLLECTION_NAME = GENERATE_NAME();

describe(`Database API`, () => {
  it(`create database should be ok`, async () => {
    try {
      const res = await milvusClient.createDatabase({
        db_name: DB_NAME,
      });

      expect(res.error_code).toEqual(ErrorCode.SUCCESS);
    } catch (error) {
      console.log('create err', error);
    }
  });

  it(`using database should be ok`, async () => {
    try {
      // use db
      const res = await milvusClient.use({ database: DB_NAME });
      expect(res!.error_code).toEqual(ErrorCode.SUCCESS);

      // create collection on another db
      const createdbRes = await milvusClient.createCollection(
        genCollectionParams({ collectionName: COLLECTION_NAME, dim: 4 })
      );
      expect(createdbRes.error_code).toEqual(ErrorCode.SUCCESS);

      // back to default
      const useDefaultDB = await milvusClient.use({ database: 'default' });
      expect(useDefaultDB.error_code).toEqual(ErrorCode.SUCCESS);

      const ShowCollectionsDefault = await milvusClient.showCollections();
      expect(ShowCollectionsDefault.data.length).toEqual(0);

      // back to db
      const useDB = await milvusClient.use({ database: DB_NAME });
      expect(useDB.error_code).toEqual(ErrorCode.SUCCESS);

      const ShowCollections = await milvusClient.showCollections();
      expect(ShowCollections.data.length).toEqual(1);

      // drop collection
      const dropCollections = await milvusClient.dropCollection({
        collection_name: COLLECTION_NAME,
      });

      expect(dropCollections.error_code).toEqual(ErrorCode.SUCCESS);

      // back to default
      const useDefaultDB2 = await milvusClient.use();
      expect(useDefaultDB2.error_code).toEqual(ErrorCode.SUCCESS);

      const ShowCollectionsDefault2 = await milvusClient.showCollections();
      expect(ShowCollectionsDefault2.data.length).toEqual(0);
    } catch (error) {
      console.log('using database err', error);
    }
  });

  it(`ListDatabases should be ok`, async () => {
    try {
      const res = await milvusClient.listDatabases();

      expect(res.db_names.length).toEqual(2);
    } catch (error) {
      console.log('list err', error);
    }
  });

  it(`drop database should be ok`, async () => {
    try {
      const res = await milvusClient.dropDatabase({
        db_name: DB_NAME,
      });

      expect(res.error_code).toEqual(ErrorCode.SUCCESS);
    } catch (error) {
      console.log('drop err', error);
    }
  });
});
