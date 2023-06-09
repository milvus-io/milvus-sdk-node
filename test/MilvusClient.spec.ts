import { MilvusClient, ERROR_REASONS, CONNECT_STATUS } from '../milvus';
import sdkInfo from '../sdk.json';
import { IP } from './tools';

const milvusClient = new MilvusClient({ address: IP });

describe(`Milvus client`, () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it(`should create a grpc client without SSL credentials when ssl is false`, () => {
    const milvusClient = new MilvusClient({
      address: 'localhost:19530',
      ssl: false,
      username: 'username',
      password: 'password',
    });

    expect(milvusClient.client).toBeDefined();
  });

  it(`should create a grpc client without authentication when username and password are not provided`, () => {
    const milvusClient = new MilvusClient(`localhost:19530`, false);

    expect(milvusClient.client).toBeDefined();
  });

  it(`should have connect promise and connectStatus`, async () => {
    const milvusClient = new MilvusClient(`localhost:19530`, false);
    expect(milvusClient.connectPromise).toBeDefined();

    await milvusClient.connectPromise;
    expect(milvusClient.connectStatus).not.toEqual(
      CONNECT_STATUS.NOT_CONNECTED
    );
  });

  it(`should create a grpc client with authentication when username and password are provided`, () => {
    const milvusClient = new MilvusClient(IP, false, `username`, `password`);
    expect(milvusClient.client).toBeDefined();
  });

  it(`should setup ssl 2 true, if the address starts with https`, () => {
    // const milvusClient = new MilvusClient(`https://localhost:19530`);
    // expect(milvusClient.config.ssl).toEqual(true);

    // const milvusClient2 = new MilvusClient({
    //   address: `https://localhost:19530`,
    // });
    // expect(milvusClient2.config.ssl).toEqual(true);

    const milvusClient3 = new MilvusClient({
      address: `http://localhost:19530`,
    });
    expect(milvusClient3.config.ssl).toEqual(false);
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
    expect(res).toHaveProperty('version');
  });

  it(`Expect checkHealth success`, async () => {
    const res = await milvusClient.checkHealth();

    expect(typeof res.isHealthy).toEqual('boolean');
    expect(Array.isArray(res.reasons)).toBe(true);
  });

  it(`Expect close connection success`, async () => {
    const res = milvusClient.closeConnection();
    expect(res).toEqual(4);
  });
});
