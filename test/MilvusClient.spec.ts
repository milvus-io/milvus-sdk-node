import { MilvusClient } from "../dist/milvus/index";
import sdkInfo from "../dist/sdk.json";
import { IP } from "../const";

const milvusClient = new MilvusClient(IP);

describe("Milvus client ", () => {
  it("Expect close connection success", async () => {
    const res = milvusClient.closeConnection();
    expect(res).toEqual(4);
  });

  it("Expect get node sdk vertion", async () => {
    expect(MilvusClient.getSdkVersion().version).toEqual(sdkInfo.version);
  });
});
