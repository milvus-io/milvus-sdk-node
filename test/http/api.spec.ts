import { HttpClient, MilvusClient } from '../../milvus';
import {
  IP,
  ENDPOINT,
  genCollectionParams,
  generateInsertData,
  dynamicFields,
} from '../tools';

const milvusClient = new MilvusClient({ address: IP });
const dbParam = {
  db_name: 'HttpClient_collections',
};

describe(`HTTP API tests`, () => {
  // Mock configuration object
  const config = {
    endpoint: ENDPOINT,
    database: dbParam.db_name,
  };

  const createParams = {
    dimension: 4,
    collectionName: 'my_collection',
    metricType: 'L2',
    primaryField: 'id',
    vectorField: 'vector',
    description: 'des',
  };

  const count = 10;
  const data = generateInsertData(
    [
      ...genCollectionParams({
        collectionName: createParams.collectionName,
        dim: createParams.dimension,
        enableDynamic: true,
      }).fields,
      ...dynamicFields,
    ],
    count
  );

  // Create an instance of HttpBaseClient with the mock configuration
  const client = new HttpClient(config);

  beforeAll(async () => {
    await milvusClient.createDatabase(dbParam);
    await milvusClient.use(dbParam);
  });

  afterAll(async () => {
    // await milvusClient.dropCollection({
    //   collection_name: createParams.collectionName,
    // });
    await milvusClient.dropDatabase(dbParam);
  });

  it('should create collection successfully', async () => {
    const create = await client.createCollection(createParams);

    const hasCollection = await milvusClient.hasCollection({
      collection_name: createParams.collectionName,
    });

    expect(create.code).toEqual(200);
    expect(hasCollection.value).toEqual(true);
  });

  it('should describe collection successfully', async () => {
    const describe = await client.describeCollection({
      collectionName: createParams.collectionName,
    });

    expect(describe.code).toEqual(200);
    expect(describe.data.description).toEqual(createParams.description);
    expect(describe.data.shardsNum).toEqual(1);
    expect(describe.data.enableDynamic).toEqual(true);
    expect(describe.data.fields.length).toEqual(2);
  });

  it('should list collections successfully', async () => {
    const list = await client.listCollections();
    expect(list.code).toEqual(200);
    expect(list.data[0]).toEqual(createParams.collectionName);
  });

  it('should insert data successfully', async () => {
    const insert = await client.insert({
      collectionName: createParams.collectionName,
      data: data,
    });

    expect(insert.code).toEqual(200);
    expect(insert.data.insertCount).toEqual(count);
  });

  it('should query data successfully', async () => {
    const query = await client.query({
      collectionName: createParams.collectionName,
      outputFields: ['id'],
      filter: 'id > 0',
    });

    expect(query.code).toEqual(200);
    expect(query.data.length).toEqual(data.length);
  });

  it('should search data successfully', async () => {
    const search = await client.search({
      collectionName: createParams.collectionName,
      outputFields: ['*'],
      vector: [1, 2, 3, 4],
      limit: 5,
    });

    expect(search.code).toEqual(200);
    expect(search.data.length).toEqual(5);
    expect(typeof search.data[0].distance).toEqual('number');
  });

  it('should drop collection successfully', async () => {
    const drop = await client.dropCollection({
      collectionName: createParams.collectionName,
    });

    expect(drop.code).toEqual(200);
  });
});
