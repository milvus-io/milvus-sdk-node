import { MilvusClient, ERROR_REASONS, CONNECT_STATUS } from '../../milvus';
import sdkInfo from '../../sdk.json';
import { IP } from '../tools';

const milvusClient = new MilvusClient({
  address: IP,
});

describe(`Milvus client`, () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // it(`should create a grpc client with cert file successfully`, async () => {
  //   const milvusClient = new MilvusClient({
  //     address: IP,
  //     tls: {
  //       rootCertPath: `test/cert/ca.pem`,
  //       privateKeyPath: `test/cert/client.key`,
  //       certChainPath: `test/cert/client.pem`,
  //       serverName: IP,
  //     },
  //     id: '1',
  //   });

  //   expect(milvusClient.client).toBeDefined();
  //   expect(milvusClient.tlsMode).toEqual(2);
  //   expect(milvusClient.clientId).toEqual('1');
  // });

  it(`should create a grpc client without SSL credentials when ssl is false`, () => {
    const milvusClient = new MilvusClient({
      address: IP,
      ssl: false,
      username: 'username',
      password: 'password',
      id: '1',
    });

    expect(milvusClient.clientId).toEqual('1');
    expect(milvusClient.client).toBeDefined();
  });

  it(`should create a grpc client without authentication when username and password are not provided`, () => {
    const milvusClient = new MilvusClient(IP, false);

    expect(milvusClient.client).toBeDefined();
  });

  it(`should have connect promise and connectStatus`, async () => {
    const milvusClient = new MilvusClient(IP, false);
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

  it(`Should throw MILVUS_ADDRESS_IS_REQUIRED`, async () => {
    try {
      new MilvusClient(undefined as any);
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.MILVUS_ADDRESS_IS_REQUIRED);
    }
  });

  it(`Expect get node sdk info`, async () => {
    expect(MilvusClient.sdkInfo.version).toEqual(sdkInfo.version);
    expect(MilvusClient.sdkInfo.recommendMilvus).toEqual(sdkInfo.milvusVersion);
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
