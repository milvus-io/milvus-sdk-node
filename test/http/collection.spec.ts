import { HttpClient, MilvusClient } from '../../milvus';
import { IP, ADDRESS } from '../tools';

const milvusClient = new MilvusClient({ address: IP });
const dbParam = {
  db_name: 'HttpClient',
};

describe(`Collection HTTP API`, () => {
  // Mock configuration object
  const config = {
    address: ADDRESS,
    database: dbParam.db_name,
  };

  const createPraram = {
    dimension: 4,
    collectionName: 'my_collection',
    metricType: 'L2',
    primaryField: 'id',
    vectorField: 'vector',
    description: 'des',
  };

  // Create an instance of HttpBaseClient with the mock configuration
  const client = new HttpClient(config);

  beforeAll(async () => {
    await milvusClient.createDatabase(dbParam);
    await milvusClient.use(dbParam);
  });

  afterAll(async () => {
    // await milvusClient.dropCollection({
    //   collection_name: createPraram.collectionName,
    // });
    await milvusClient.dropDatabase(dbParam);
  });

  it('should call createCollection successfully', async () => {
    const create = await client.createCollection(createPraram);

    const hasCollection = await milvusClient.hasCollection({
      collection_name: createPraram.collectionName,
    });

    expect(create.code).toEqual(200);
    expect(hasCollection.value).toEqual(true);
  });

  it('should describe createCollection successfully', async () => {
    const describe = await client.describeCollection({
      collectionName: createPraram.collectionName,
    });

    expect(describe.code).toEqual(200);
    expect(describe.data.description).toEqual(createPraram.description);
    expect(describe.data.shardsNum).toEqual(1);
    expect(describe.data.enableDynamic).toEqual(true);
    expect(describe.data.fields.length).toEqual(2);
  });

  it('should list collections successfully', async () => {
    const list = await client.listCollection();
    expect(list.code).toEqual(200);
    expect(list.data[0]).toEqual(createPraram.collectionName);
  });

  it('should drop collection successfully', async () => {
    const drop = await client.dropCollection({
      collectionName: createPraram.collectionName,
    });

    expect(drop.code).toEqual(200);
  });
});
