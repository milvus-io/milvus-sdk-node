import { MilvusClient, ERROR_REASONS } from '../milvus';
import sdkInfo from '../sdk.json';
import { IP } from './tools';

const milvusClient = new MilvusClient({ address: IP, debug: false });

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
      debug: true,
    });

    expect(milvusClient.client).toBeDefined();
  });

  it(`should create a grpc client without authentication when username and password are not provided`, () => {
    const milvusClient = new MilvusClient(`localhost:19530`, false);
    expect(milvusClient.client).toBeDefined();
  });

  it(`should create a grpc client with authentication when username and password are provided`, () => {
    const milvusClient = new MilvusClient(IP, false, `username`, `password`);
    expect(milvusClient.client).toBeDefined();
  });

  it(`should setup ssl 2 true, if the address starts with https`, () => {
    const milvusClient = new MilvusClient(`https://localhost:19530`);
    expect(milvusClient.config.ssl).toEqual(true);

    const milvusClient2 = new MilvusClient({
      address: `https://localhost:19530`,
    });
    expect(milvusClient2.config.ssl).toEqual(true);

    const milvusClient3 = new MilvusClient({
      address: `http://localhost:19530`,
    });
    expect(milvusClient3.config.ssl).toEqual(false);
  });

  it(`should setup user name password if only provides token`, () => {
    const milvusClient = new MilvusClient({
      address: `https://localhost:19530`,
      token: 'username:password',
    });
    expect(milvusClient.config.username).toEqual('username');
    expect(milvusClient.config.password).toEqual('password');
  });

  it(`should overwrite user name password if provides token and username and password`, () => {
    const milvusClient = new MilvusClient({
      address: `https://localhost:19530`,
      token: 'u1:p1',
      username: 'username',
      password: 'password',
    });
    expect(milvusClient.config.username).toEqual('u1');
    expect(milvusClient.config.password).toEqual('p1');

    const milvusClient2 = new MilvusClient({
      address: `https://localhost:19530`,
      token: ':p1',
      username: 'username',
      password: 'password',
    });
    expect(milvusClient2.config.username).toEqual('username');
    expect(milvusClient2.config.password).toEqual('p1');

    const milvusClient3 = new MilvusClient({
      address: `https://localhost:19530`,
      token: ':',
      username: 'username',
      password: 'password',
    });
    expect(milvusClient3.config.username).toEqual('username');
    expect(milvusClient3.config.password).toEqual('password');

    const milvusClient4 = new MilvusClient({
      address: `https://localhost:19530`,
      token: 'u1:',
      username: 'username',
      password: 'password',
    });
    expect(milvusClient4.config.username).toEqual('u1');
    expect(milvusClient4.config.password).toEqual('password');

    const milvusClient5 = new MilvusClient({
      address: `https://localhost:19530`,
      token: 'u1', // invalid token
      username: 'username',
      password: 'password',
    });

    expect(milvusClient5.config.username).toEqual('username');
    expect(milvusClient5.config.password).toEqual('password');

    const milvusClient6 = new MilvusClient({
      address: `https://localhost:19530`,
      token: '', // invalid token
      username: 'username',
      password: 'password',
    });

    expect(milvusClient6.config.username).toEqual('username');
    expect(milvusClient6.config.password).toEqual('password');
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
