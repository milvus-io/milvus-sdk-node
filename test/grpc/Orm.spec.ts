import {
  OrmClient as MilvusClient,
  ErrorCode,
  DataType,
  ConsistencyLevelEnum,
} from '../../milvus';
import {
  IP,
  genCollectionParams,
  GENERATE_NAME,
  generateInsertData,
  dynamicFields,
} from '../tools';
import { Collection } from '../../milvus/orm';

let milvusClient = new MilvusClient({ address: IP });
const EXIST_COLLECTION_NAME = GENERATE_NAME();
const NEW_COLLECTION_NAME = GENERATE_NAME();
const NEW_COLLECTION_NAME2 = GENERATE_NAME();
const NEW_COLLECTION_WITH_INDEX_PARAMS = GENERATE_NAME();
const EXIST_COLLECTION_PARAMS = genCollectionParams({
  collectionName: EXIST_COLLECTION_NAME,
  dim: [8],
  enableDynamic: true,
});
const EXIST_LOADED_COLLECTION_NAME = GENERATE_NAME();
const EXIST_LOADED_COLLECTION_PARAMS = genCollectionParams({
  collectionName: EXIST_LOADED_COLLECTION_NAME,
  dim: [8],
  enableDynamic: true,
});
const EXIST_INDEXED_COLLECTION_NAME = GENERATE_NAME();
const EXIST_INDEXED_COLLECTION_PARAMS = genCollectionParams({
  collectionName: EXIST_INDEXED_COLLECTION_NAME,
  dim: [8],
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
    const cols = [
      NEW_COLLECTION_NAME,
      NEW_COLLECTION_NAME2,
      EXIST_COLLECTION_NAME,
      EXIST_INDEXED_COLLECTION_NAME,
      EXIST_LOADED_COLLECTION_NAME,
      NEW_COLLECTION_WITH_INDEX_PARAMS,
    ];

    for (let i = 0; i < cols.length; i++) {
      await milvusClient.dropCollection({
        collection_name: cols[i],
      });
    }

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

  it(`get existing collection successfully`, async () => {
    // get my collection
    const collection: any = await milvusClient.collection({
      collection_name: EXIST_COLLECTION_NAME,
      dimension: 8,
    });

    const collectionInfo = await collection.info();
    expect(collection.name).toEqual(EXIST_COLLECTION_NAME);
    expect(collectionInfo.schema.fields.length).toEqual(
      EXIST_INDEXED_COLLECTION_PARAMS.fields.length
    );
  });

  it(`get existing indexed collection successfully`, async () => {
    // get my collection
    const collection: any = await milvusClient.collection({
      collection_name: EXIST_INDEXED_COLLECTION_NAME,
      dimension: 8,
    });

    expect(collection.name).toEqual(EXIST_INDEXED_COLLECTION_NAME);
  });

  it(`get existing loaded collection successfully`, async () => {
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
      consistency_level: ConsistencyLevelEnum.Strong,
    });

    expect(searchRes.results.length).toEqual(2);

    // query
    const queryRes = await collection.query({
      filter: 'int64 > 0',
      output_fields: ['int64', 'id'],
      limit: 2,
    });

    expect(queryRes.status.error_code).toEqual(ErrorCode.SUCCESS);
    expect(queryRes.data.length).toEqual(2);

    // get
    const getRes = await collection.get({
      ids: [1, 2, 3],
      output_fields: ['int64', 'id'],
      limit: 2,
    });

    expect(getRes.status.error_code).toEqual(ErrorCode.SUCCESS);

    // delete
    const deleteRes = await collection.delete({
      ids: [1, 2, 3],
    });

    expect(deleteRes.status.error_code).toEqual(ErrorCode.SUCCESS);

    // delete
    const delete2Res = await collection.delete({
      filter: 'id < 5',
    });
    expect(delete2Res.status.error_code).toEqual(ErrorCode.SUCCESS);

    try {
      await collection.delete({} as any);
    } catch (error) {
      expect(error.message).toEqual(`Invalid delete request`);
    }
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

  it(`create collection with index params successfully`, async () => {
    const cols = await milvusClient.collection({
      collection_name: NEW_COLLECTION_WITH_INDEX_PARAMS,
      dimension: 8,
      index_params: { metric_type: 'L2' },
    });

    const info = await cols.info();

    expect(
      info.index_descriptions[0].params.some(d => {
        return d.key === 'metric_type' && d.value === 'L2';
      })
    ).toEqual(true);
  });

  it(`create collection should fail`, async () => {
    const collection = await milvusClient.collection({
      collection_name: NEW_COLLECTION_NAME2,
      dimension: 8,
    });

    expect(collection.pkFieldName).toEqual('id');
    expect(collection.vectorFieldName).toEqual('vector');
    expect(collection.dim).toEqual(8);
    expect(collection.vectorType).toEqual(DataType.FloatVector);

    try {
      await milvusClient.collection({
        collection_name: NEW_COLLECTION_NAME2,
        dimension: 8,
        index_params: { metric_type: 'L2' },
      });
    } catch (error) {
      expect(error.message).toBeDefined();
    }
  });
});
