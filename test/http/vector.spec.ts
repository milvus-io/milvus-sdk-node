import { HttpClient, MilvusClient } from '../../milvus';
import {
  IP,
  ADDRESS,
  generateInsertData,
  dynamicFields,
  genCollectionParams,
  GENERATE_NAME,
} from '../tools';

const milvusClient = new MilvusClient({ address: IP });
const dbParam = {
  db_name: 'HttpClient_vectors',
};

describe(`Vector HTTP API tests`, () => {
  // Mock configuration object
  const config = {
    address: ADDRESS,
    database: dbParam.db_name,
  };

  const COLLECTION_NAME = GENERATE_NAME();
  const params = {
    collectionName: COLLECTION_NAME,
    dim: 8,
    enableDynamic: true,
  };
  const count = 10;
  const COLLECTION_PARAMS = genCollectionParams(params);
  const data = generateInsertData(
    [...COLLECTION_PARAMS.fields, ...dynamicFields],
    count
  );

  const createPraram = {
    dimension: params.dim,
    collectionName: params.collectionName,
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
    await milvusClient.dropCollection({
      collection_name: createPraram.collectionName,
    });
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

  it('should insert data successfully', async () => {
    const insert = await client.insert({
      collectionName: createPraram.collectionName,
      data: data,
    });

    expect(insert.code).toEqual(200);
    expect(insert.data.insertCount).toEqual(count);
  });
});
