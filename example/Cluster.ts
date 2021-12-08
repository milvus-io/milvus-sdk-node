import { MilvusClient } from "../milvus/index";
import { IP, GENERATE_NAME } from "../const";
import { genCollectionParams } from "../utils/test";
const milvusClient = new MilvusClient(IP);
const dataManager = milvusClient.dataManager;
console.log(MilvusClient.getSdkVersion());

const test = async () => {
  let res: any = await dataManager.getMetric({
    request: { metric_type: "system_info" },
  });
};

test();
