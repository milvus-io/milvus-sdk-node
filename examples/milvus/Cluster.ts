import { MilvusClient } from '@zilliz/milvus2-sdk-node';
const milvusClient = new MilvusClient({ address: 'localhost' });

(async () => {
  let res: any = await milvusClient.getMetric({
    request: { metric_type: 'system_info' },
  });

  // get cluster infomation
  res.response.nodes_info.forEach((v: any) => {
    console.log(v.infos);
  });
})();
