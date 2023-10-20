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

  it(`init http client successfully`, async () => {
    const milvusClient = new HttpClient({
      address: IP,
    });

    expect(milvusClient.config.address).toEqual(IP);
  });

  it(`client config should be set`, async () => {
    const milvusClient = new HttpClient({
      address: IP,
    });

    expect(milvusClient.config.address).toEqual(IP);
  });
});
