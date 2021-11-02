import { MilvusClient } from "../milvus";
import sdkInfo from "../sdk.json";
import { IP } from "../const";
import { ERROR_REASONS } from "../milvus/const/ErrorReason";

const milvusClient = new MilvusClient(IP);

describe("Milvus client ", () => {
  it("Should throw MILVUS_ADDRESS_IS_REQUIRED", async () => {
    try {
      new MilvusClient(undefined as any);
    } catch (error) {
      expect(error.message).toEqual(ERROR_REASONS.MILVUS_ADDRESS_IS_REQUIRED);
    }
  });
  it("Expect close connection success", async () => {
    const res = milvusClient.closeConnection();
    expect(res).toEqual(4);
  });

  it("Expect get node sdk vertion", async () => {
    expect(MilvusClient.getSdkVersion().version).toEqual(sdkInfo.version);
  });
});
