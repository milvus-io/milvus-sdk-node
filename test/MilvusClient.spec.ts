import { MilvusClient } from "../milvus";
import sdkInfo from "../sdk.json";
import { IP } from "../const";
import { ERROR_REASONS } from "../milvus/const/ErrorReason";
import { ErrorCode } from "../milvus/types/Response";

const milvusClient = new MilvusClient(IP);

describe("Milvus client ", () => {
  it("Should throw MILVUS_ADDRESS_IS_REQUIRED", async () => {
    try {
      new MilvusClient(undefined as any);
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.MILVUS_ADDRESS_IS_REQUIRED);
    }
  });

  it("Expect get node sdk info", async () => {
    expect(milvusClient.sdkInfo.version).toEqual(sdkInfo.version);
    expect(milvusClient.sdkInfo.recommandMilvus).toEqual(sdkInfo.milvusVersion);
  });

  it("Check version should success", async () => {
    const res = await milvusClient.checkVersion();
    expect(res.error_code).toEqual(ErrorCode.SUCCESS);
  });

  it("Expect close connection success", async () => {
    const res = milvusClient.closeConnection();
    expect(res).toEqual(4);
  });
});
