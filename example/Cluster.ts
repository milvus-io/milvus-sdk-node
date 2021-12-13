import { MilvusClient } from "../milvus/index";
import { IP } from "../const";

const milvusClient = new MilvusClient(IP);
const dataManager = milvusClient.dataManager;

console.log(MilvusClient.getSdkVersion());

const test = async () => {
  let res: any = await dataManager.getMetric({
    request: { metric_type: "system_info" },
  });
  console.log("---  metric ---", res.response.nodes_info[0].infos);

  // res = await dataManager.getQuerySegmentInfo({
  //   collectionName: COLLECTION_NAME,
  // });
  // console.log("--- seg info ---", res);

  // // only work in cluster version
  // res = await dataManager.loadBalance({
  //   src_nodeID: res.infos[0].nodeID,
  // });
  // console.log("-- load balance ---", res);
};

test();
