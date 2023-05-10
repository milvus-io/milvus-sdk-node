import { MilvusClient, ERROR_REASONS } from '../milvus';
import { IP, genCollectionParams, GENERATE_NAME } from './tools';

let milvusClient = new MilvusClient({ address: IP });
const EXIST_COLLECTION_NAME = GENERATE_NAME();
const NEW_COLLECTION_NAME = GENERATE_NAME();

const params = genCollectionParams(EXIST_COLLECTION_NAME, '8');

describe(`High level API`, () => {
  beforeAll(async () => {
    await milvusClient.createCollection(params);
  });

  afterAll(async () => {
    await milvusClient.dropCollection({
      collection_name: NEW_COLLECTION_NAME,
    });
    await milvusClient.dropCollection({
      collection_name: EXIST_COLLECTION_NAME,
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

    expect(collections.data.length).toEqual(2);
    // insert
  });

  it(`get exsiting collection successfully`, async () => {
    // get my collection
    console.time('get existing collection');
    const collection: any = await milvusClient.collection({
      name: EXIST_COLLECTION_NAME,
    });

    console.timeEnd('get existing collection');

    console.log('existing collection', collection);
    // insert
  });
});
