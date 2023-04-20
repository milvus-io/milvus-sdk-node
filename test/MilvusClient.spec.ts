import { MilvusClient, ERROR_REASONS } from '../milvus';
import sdkInfo from '../sdk.json';
import { IP } from '../const';

const milvusClient = new MilvusClient(IP);

describe(`Milvus client`, () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test(`should create a grpc client without SSL credentials when ssl is false`, () => {
    const client = new MilvusClient({
      address: 'localhost:19530',
      ssl: false,
      username: 'username',
      password: 'password',
    });
    expect(client.grpcClient).toBeDefined();
  });

  test(`should create a grpc client without authentication when username and password are not provided`, () => {
    const client = new MilvusClient(`localhost:19530`, false);
    expect(client.grpcClient).toBeDefined();
  });

  test(`should create a grpc client with authentication when username and password are provided`, () => {
    const client = new MilvusClient(IP, false, `username`, `password`);
    expect(client.grpcClient).toBeDefined();
  });

  it(`Should throw MILVUS_ADDRESS_IS_REQUIRED`, async () => {
    try {
      new MilvusClient(undefined as any);
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.MILVUS_ADDRESS_IS_REQUIRED);
    }
  });

  it(`Expect get node sdk info`, async () => {
    expect(MilvusClient.sdkInfo.version).toEqual(sdkInfo.version);
    expect(MilvusClient.sdkInfo.recommandMilvus).toEqual(sdkInfo.milvusVersion);
  });

  it(`Get milvus version`, async () => {
    const res = await milvusClient.getVersion();

    // console.log('----getVersion ----', res);
    expect(res).toHaveProperty('version');
  });

  it(`Expect checkHealth success`, async () => {
    const res = await milvusClient.checkHealth();

    // console.log('----checkHealth ----', res);
    expect(typeof res.isHealthy).toEqual('boolean');
    expect(Array.isArray(res.reasons)).toBe(true);
  });

  it(`Expect close connection success`, async () => {
    const res = milvusClient.closeConnection();
    // console.log('----closeConnection ----', res);
    expect(res).toEqual(4);
  });

  it(`Expect *Managers are working`, async () => {
    expect(typeof milvusClient.collectionManager === typeof milvusClient);
    expect(typeof milvusClient.dataManager === typeof milvusClient);
    expect(typeof milvusClient.indexManager === typeof milvusClient);
    expect(typeof milvusClient.userManager === typeof milvusClient);
    expect(typeof milvusClient.resourceManager === typeof milvusClient);
    expect(typeof milvusClient.partitionManager === typeof milvusClient);
  });
});
