import path from 'path';
import {
  MilvusClient,
  ERROR_REASONS,
  CONNECT_STATUS,
  TLS_MODE,
} from '../../milvus';
import sdkInfo from '../../sdk.json';
import { IP } from '../tools';

const milvusClient = new MilvusClient({
  address: IP,
});

// path
const milvusProtoPath = path.resolve(
  __dirname,
  '../../proto/proto/milvus.proto'
);
const schemaProtoPath = path.resolve(
  __dirname,
  '../../proto/proto/schema.proto'
);

describe(`Milvus client`, () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await milvusClient.closeConnection();
  });

  it(`should create a grpc client with cert file successfully`, async () => {
    const m1 = new MilvusClient({
      address: IP,
      tls: {
        rootCertPath: `test/cert/ca.pem`,
        privateKeyPath: `test/cert/client.key`,
        certChainPath: `test/cert/client.pem`,
        serverName: IP,
      },
      id: '1',
      __SKIP_CONNECT__: true,
    });

    expect(await m1.channelPool).toBeDefined();
    expect(m1.tlsMode).toEqual(TLS_MODE.TWO_WAY);
    expect(m1.clientId).toEqual('1');
  });

  it(`should create a grpc client without SSL credentials when ssl is false`, async () => {
    const m2 = new MilvusClient({
      address: IP,
      ssl: true,
      username: 'username',
      password: 'password',
      id: '1',
      __SKIP_CONNECT__: true,
    });

    expect(m2.clientId).toEqual('1');
    expect(m2.tlsMode).toEqual(TLS_MODE.ONE_WAY);
  });

  it(`should create a grpc client without authentication when username and password are not provided`, async () => {
    const m3 = new MilvusClient(IP, false);
    await m3.connectPromise;

    expect(m3.channelPool).toBeDefined();
    await m3.closeConnection();
    expect(m3.connectStatus).toEqual(CONNECT_STATUS.SHUTDOWN);
  });

  it(`should have connect promise and connectStatus`, async () => {
    const m4 = new MilvusClient(IP, false);
    expect(m4.connectPromise).toBeDefined();

    await m4.connectPromise;
    expect(m4.connectStatus).not.toEqual(CONNECT_STATUS.NOT_CONNECTED);
    await m4.closeConnection();
    expect(m4.connectStatus).toEqual(CONNECT_STATUS.SHUTDOWN);
  });

  it(`should create a grpc client with authentication when username and password are provided`, async () => {
    const m5 = new MilvusClient({
      address: IP,
      username: 'username',
      password: 'password',
      id: '1',
      __SKIP_CONNECT__: true,
    });
    expect(await m5.channelPool).toBeDefined();
  });

  it(`should setup protofile path successfully`, async () => {
    const m6 = new MilvusClient({
      address: IP,
      protoFilePath: {
        milvus: milvusProtoPath,
        schema: schemaProtoPath,
      },
      __SKIP_CONNECT__: true,
    });

    expect(await m6.channelPool).toBeDefined();
    expect(m6.protoFilePath.milvus).toEqual(milvusProtoPath);
    expect(m6.protoFilePath.schema).toEqual(schemaProtoPath);
  });

  it(`should set tls to 1 if root cert provided`, async () => {
    const m7 = new MilvusClient({
      address: IP,
      ssl: true,
      username: 'username',
      password: 'password',
      id: '1',
      tls: {
        rootCertPath: `test/cert/ca.pem`,
      },
      __SKIP_CONNECT__: true,
    });

    expect(m7.tlsMode).toEqual(TLS_MODE.ONE_WAY);
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
    expect(milvusClient.channelPool.size).toBeGreaterThan(0);

    const res = await milvusClient.closeConnection();
    expect(milvusClient.channelPool.size).toBe(0);
    expect(res).toBe(CONNECT_STATUS.SHUTDOWN);
  });
});
