import { MilvusClient, ErrorCode } from '../milvus';
import {
  IP,
  genCollectionParams,
  GENERATE_NAME,
  generateInsertData,
} from './tools';

let milvusClient = new MilvusClient({ address: IP });
const EXIST_COLLECTION_NAME = GENERATE_NAME();
const NEW_COLLECTION_NAME = GENERATE_NAME();
const EXIST_COLLECTION_PARAMS = genCollectionParams({
  collectionName: EXIST_COLLECTION_NAME,
  dim: '8',
});
const EXIST_LOADED_COLLECTION_NAME = GENERATE_NAME();
const EXIST_LOADED_COLLECTION_PARAMS = genCollectionParams({
  collectionName: EXIST_LOADED_COLLECTION_NAME,
  dim: '8',
});
const EXIST_INDEXED_COLLECTION_NAME = GENERATE_NAME();
const EXIST_INDEXED_COLLECTION_PARAMS = genCollectionParams({
  collectionName: EXIST_INDEXED_COLLECTION_NAME,
  dim: '8',
});

const dbParam = {
  db_name: 'HighLevel',
};

const data = generateInsertData(EXIST_COLLECTION_PARAMS.fields, 10);

// console.log('data to insert', data);

describe(`High level API`, () => {
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
      index_type: 'HNSW',
      metric_type: 'L2',
      params: { efConstruction: 10, M: 4 },
    });
    // loaded collection
    await milvusClient.createCollection(EXIST_LOADED_COLLECTION_PARAMS);
    await milvusClient.createIndex({
      collection_name: EXIST_LOADED_COLLECTION_NAME,
      field_name: 'vector',
      index_type: 'HNSW',
      metric_type: 'L2',
      params: { efConstruction: 10, M: 4 },
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
      name: NEW_COLLECTION_NAME,
      dimension: 8,
    });

    const collections = await milvusClient.showCollections();
    expect(collections.data.length).toEqual(4);
    expect(collection.name).toEqual(NEW_COLLECTION_NAME);
    const collectionInfo = await collection.info();
    expect(collectionInfo.schema.fields.length).toEqual(2); // TODO: json

    const count = await collection.count();
    expect(typeof count).toEqual('number');
    // insert
  });

  it(`get exsiting collection successfully`, async () => {
    // get my collection
    const collection: any = await milvusClient.collection({
      name: EXIST_COLLECTION_NAME,
    });

    const collectionInfo = await collection.info();

    expect(collection.name).toEqual(EXIST_COLLECTION_NAME);

    expect(collectionInfo.schema.fields.length).toEqual(4);

    // insert
  });

  it(`get exsiting indexed collection successfully`, async () => {
    // get my collection
    const collection: any = await milvusClient.collection({
      name: EXIST_INDEXED_COLLECTION_NAME,
    });

    expect(collection.name).toEqual(EXIST_INDEXED_COLLECTION_NAME);
    // insert
  });

  it(`get exsiting loaded collection successfully`, async () => {
    // get my collection
    const collection: any = await milvusClient.collection({
      name: EXIST_LOADED_COLLECTION_NAME,
    });

    expect(collection.name).toEqual(EXIST_LOADED_COLLECTION_NAME);
    // insert
  });

  it(`insert/search/query/delete successfully`, async () => {
    // get my collection
    const collection = await milvusClient.collection({
      name: EXIST_COLLECTION_NAME,
    });

    // insert data
    await collection.insert({ fields_data: data });

    // search
    const searchRes = await collection.search({
      vector: [1, 2, 3, 4, 5, 6, 7, 8],
      limit: 2,
    });

    expect(searchRes.results.length).toEqual(2);

    // console.log('searchRes', searchRes);

    // query
    const queryRes = await collection.query({
      expr: 'height > 0',
      output_fields: ['height', 'age'],
      limit: 2,
    });

    expect(queryRes.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(queryRes.data.length).toEqual(2);

    // get
    const getRes = await collection.get({
      expr: 'height > 0',
      output_fields: ['height', 'age'],
      limit: 2,
    });

    expect(getRes.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(getRes.data.length).toEqual(2);

    // delete
    const deleteRes = await collection.delete({
      expr: `age in [${queryRes.data.map(d => d.age).join(',')}]`,
    });

    // console.log('deleteRes', queryRes, deleteRes);
    expect(deleteRes.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(Number(deleteRes.delete_cnt)).toEqual(2);
  });
});
