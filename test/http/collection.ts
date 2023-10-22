import { HttpClient, MilvusClient } from '../../milvus';
import { IP } from '../tools';

const milvusClient = new MilvusClient({ address: IP });
const dbParam = {
  db_name: 'HttpClient',
};

describe(`Collection HTTP API`, () => {
  beforeAll(async () => {
    await milvusClient.createDatabase(dbParam);
    await milvusClient.use(dbParam);
  });

  afterAll(async () => {
    await milvusClient.dropDatabase(dbParam);
  });

  // Mock configuration object
  const config = {
    address: IP,
  };

  // Create an instance of HttpBaseClient with the mock configuration
  const client = new HttpClient(config);
});
