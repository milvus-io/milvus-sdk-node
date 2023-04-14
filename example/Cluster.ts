import { MilvusClient } from '@zilliz/milvus2-sdk-node';
import { IP } from '../const';

const milvusClient = new MilvusClient(IP);

const test = async () => {
  let res: any = await milvusClient.getMetric({
    request: { metric_type: 'system_info' },
  });
  res.response.nodes_info.forEach((v: any) => {
    console.log(v.infos);
  });
};

test();
