import { MilvusClient } from '../milvus';
import sdkInfo from '../sdk.json';
import { IP } from '../const';
import { ERROR_REASONS } from '../milvus/const/ErrorReason';
import { ErrorCode } from '../milvus/types';

const milvusClient = new MilvusClient(IP);

describe('Milvus client ', () => {
  it('Should throw MILVUS_ADDRESS_IS_REQUIRED', async () => {
    try {
      new MilvusClient(undefined as any);
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.MILVUS_ADDRESS_IS_REQUIRED);
    }
  });

  it('Expect get node sdk info', async () => {
    expect(MilvusClient.sdkInfo.version).toEqual(sdkInfo.version);
    expect(MilvusClient.sdkInfo.recommandMilvus).toEqual(sdkInfo.milvusVersion);
  });

  it('Check version should success', async () => {
    const res = await milvusClient.checkVersion();
    // console.log('----checkVersion ----', res);
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it('Get milvus version', async () => {
    const res = await milvusClient.getVersion();

    // console.log('----getVersion ----', res);
    expect(res).toHaveProperty('version');
  });

  it('Expect checkHealth success', async () => {
    const res = await milvusClient.checkHealth();

    // console.log('----checkHealth ----', res);
    expect(typeof res.isHealthy).toEqual('boolean');
    expect(Array.isArray(res.reasons)).toBe(true);
  });

  it('Expect close connection success', async () => {
    const res = milvusClient.closeConnection();
    // console.log('----closeConnection ----', res);
    expect(res).toEqual(4);
  });
});
