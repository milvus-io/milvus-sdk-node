import { OrmClient as MilvusClient, ErrorCode, DataType } from '../milvus';
import {
  IP,
  genCollectionParams,
  GENERATE_NAME,
  generateInsertData,
  dynamicFields,
} from './tools';
import { Collection } from '../milvus/orm';

let milvusClient = new MilvusClient({ address: IP });
const EXIST_COLLECTION_NAME = GENERATE_NAME();
const NEW_COLLECTION_NAME = GENERATE_NAME();
const EXIST_COLLECTION_PARAMS = genCollectionParams({
  collectionName: EXIST_COLLECTION_NAME,
  dim: 8,
  enableDynamic: true,
});
const EXIST_LOADED_COLLECTION_NAME = GENERATE_NAME();
const EXIST_LOADED_COLLECTION_PARAMS = genCollectionParams({
  collectionName: EXIST_LOADED_COLLECTION_NAME,
  dim: 8,
  enableDynamic: true,
});
const EXIST_INDEXED_COLLECTION_NAME = GENERATE_NAME();
const EXIST_INDEXED_COLLECTION_PARAMS = genCollectionParams({
  collectionName: EXIST_INDEXED_COLLECTION_NAME,
  dim: 8,
  enableDynamic: true,
});

const dbParam = {
  db_name: 'ORM_Client',
};

const data = generateInsertData(
  [...EXIST_COLLECTION_PARAMS.fields, ...dynamicFields],
  10
);

describe(`ORM Client API`, () => {
  beforeAll(async () => {
    // create db and use db
    await milvusClient.createDatabase(dbParam);
    await milvusClient.use(dbParam);
    // empty collection
    await milvusClient.createCollection(EXIST_COLLECTION_PARAMS);
    // index only collection
    await milvusClient.createCollection(EXIST_INDEXED_COLLECTION_PARAMS);
    await milvusClient.createIndex({
      collection_name: EXIST_INDEXED_COLLECTION_NAME,
      field_name: 'vector',
    });
    // loaded collection
    await milvusClient.createCollection(EXIST_LOADED_COLLECTION_PARAMS);
    await milvusClient.createIndex({
      collection_name: EXIST_LOADED_COLLECTION_NAME,
      field_name: 'vector',
    });
    await milvusClient.loadCollectionSync({
      collection_name: EXIST_LOADED_COLLECTION_NAME,
    });
  });

  afterAll(async () => {
    await milvusClient.dropCollection({
      collection_name: NEW_COLLECTION_NAME,
    });
    await milvusClient.dropCollection({
      collection_name: EXIST_COLLECTION_NAME,
    });
    await milvusClient.dropCollection({
      collection_name: EXIST_INDEXED_COLLECTION_NAME,
    });
    await milvusClient.dropCollection({
      collection_name: EXIST_LOADED_COLLECTION_NAME,
    });
    await milvusClient.dropDatabase(dbParam);
  });

  it(`Create collection successfully`, async () => {
    // get my collection
    const collection = await milvusClient.collection({
      collection_name: NEW_COLLECTION_NAME,
      dimension: 8,
    });

    expect(collection.pkFieldName).toEqual('id');
    expect(collection.vectorFieldName).toEqual('vector');
    expect(collection.dim).toEqual(8);
    expect(collection.vectorType).toEqual(DataType.FloatVector);

    const collections = await milvusClient.showCollections();
    expect(collections.data.length).toEqual(4);
    expect(collection.name).toEqual(NEW_COLLECTION_NAME);
    const collectionInfo = await collection.info();
    expect(collectionInfo.schema.fields.length).toEqual(2); // TODO: json
    expect(collectionInfo.schema.enable_dynamic_field).toEqual(true);
    const count = await collection.count();
    expect(typeof count).toEqual('number');
  });

  it(`get exsiting collection successfully`, async () => {
    // get my collection
    const collection: any = await milvusClient.collection({
      collection_name: EXIST_COLLECTION_NAME,
      dimension: 8,
    });

    const collectionInfo = await collection.info();
    expect(collection.name).toEqual(EXIST_COLLECTION_NAME);
    expect(collectionInfo.schema.fields.length).toEqual(5);
  });

  it(`get exsiting indexed collection successfully`, async () => {
    // get my collection
    const collection: any = await milvusClient.collection({
      collection_name: EXIST_INDEXED_COLLECTION_NAME,
      dimension: 8,
    });

    expect(collection.name).toEqual(EXIST_INDEXED_COLLECTION_NAME);
  });

  it(`get exsiting loaded collection successfully`, async () => {
    // get my collection
    const collection: any = await milvusClient.collection({
      collection_name: EXIST_LOADED_COLLECTION_NAME,
      dimension: 8,
    });

    expect(collection.name).toEqual(EXIST_LOADED_COLLECTION_NAME);
    // insert
  });

  it(`insert/search/query/delete successfully`, async () => {
    // get my collection
    const collection = await milvusClient.collection({
      collection_name: EXIST_COLLECTION_NAME,
      dimension: 8,
    });

    // insert data
    await collection.insert({ data });

    // search
    const searchRes = await collection.search({
      data: [1, 2, 3, 4, 5, 6, 7, 8],
      limit: 2,
    });

    expect(searchRes.results.length).toEqual(2);

    // query
    const queryRes = await collection.query({
      filter: 'height > 0',
      output_fields: ['height', 'age'],
      limit: 2,
    });

    expect(queryRes.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(queryRes.data.length).toEqual(2);

    // get
    const getRes = await collection.get({
      ids: [1, 2, 3],
      output_fields: ['height', 'age'],
      limit: 2,
    });

    expect(getRes.status.error_code).toEqual(ErrorCode.SUCCESS);

    // delete
    const deleteRes = await collection.delete({
      ids: [1, 2, 3],
    });

    expect(deleteRes.status.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`index successfully`, async () => {
    // get my collection
    const collection = await milvusClient.collection({
      collection_name: EXIST_COLLECTION_NAME,
      dimension: 128,
    });

    const index = await collection.index();
    expect(index.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it(`get collections successfully`, async () => {
    const cols = await milvusClient.collections();

    cols.forEach(col => {
      expect(col instanceof Collection).toEqual(true);
    });
  });
});
