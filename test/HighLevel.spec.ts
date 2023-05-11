import { MilvusClient, ERROR_REASONS } from '../milvus';
import {
  IP,
  genCollectionParams,
  GENERATE_NAME,
  generateInsertData,
} from './tools';

let milvusClient = new MilvusClient({ address: IP });
const EXIST_COLLECTION_NAME = GENERATE_NAME();
const NEW_COLLECTION_NAME = GENERATE_NAME();
const EXIST_COLLECTION_PARAMS = genCollectionParams(EXIST_COLLECTION_NAME, '8');
const EXIST_LOADED_COLLECTION_NAME = GENERATE_NAME();
const EXIST_LOADED_COLLECTION_PARAMS = genCollectionParams(
  EXIST_LOADED_COLLECTION_NAME,
  '8'
);
const EXIST_INDEXED_COLLECTION_NAME = GENERATE_NAME();
const EXIST_INDEXED_COLLECTION_PARAMS = genCollectionParams(
  EXIST_INDEXED_COLLECTION_NAME,
  '8'
);

const data = generateInsertData(EXIST_COLLECTION_PARAMS.fields, 10);

// console.log('data to insert', data);

describe(`High level API`, () => {
  beforeAll(async () => {
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
  });

  it(`Create collection successfully`, async () => {
    // get my collection
    console.time('create collection');
    const collection = await milvusClient.collection({
      name: NEW_COLLECTION_NAME,
      dimension: 8,
    });

    const collections = await milvusClient.showCollections();

    console.timeEnd('create collection');

    console.log('create collection', collection);

    expect(collections.data.length).toEqual(4);
    expect(collection.name).toEqual(NEW_COLLECTION_NAME);
    expect(collection.schema.fields.length).toEqual(2); // TODO: json

    const sts = await collection.get();
    console.log('sts', sts);
    // insert
  });

  it(`get exsiting collection successfully`, async () => {
    // get my collection
    console.time('get existing collection');
    const collection: any = await milvusClient.collection({
      name: EXIST_COLLECTION_NAME,
    });

    console.timeEnd('get existing collection');

    expect(collection.name).toEqual(EXIST_COLLECTION_NAME);
    expect(collection.schema.fields.length).toEqual(4);

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

  it(`insert data successfully`, async () => {
    // get my collection
    console.time('insert data');
    const collection = await milvusClient.collection({
      name: EXIST_COLLECTION_NAME,
    });

    // insert data
    await collection.insert({ fields_data: data });

    // get
    const dd = await collection.query({
      expr: 'height > 0',
      output_fields: ['height', 'age'],
    });

    console.timeEnd('insert data');

    // console.log('insert collection', dd);
    // insert
  });
});
