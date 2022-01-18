import { MilvusClient } from "../milvus/index";
import { IP } from "../const";

const milvusClient = new MilvusClient(IP);
const dataManager = milvusClient.dataManager;

const test = async () => {
  let res: any = await dataManager.getMetric({
    request: { metric_type: "system_info" },
  });
  res.response.nodes_info.forEach((v: any) => {
    console.log(v.infos);
  });

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
