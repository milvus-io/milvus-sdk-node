import { MilvusClient } from '@zilliz/milvus2-sdk-node';
// import { MilvusClient } from '../dist/milvus';

const milvusClient = new MilvusClient({ address: 'localhost' });

const test = async () => {
  let res: any = await milvusClient.getMetric({
    request: { metric_type: 'system_info' },
  });
  res.response.nodes_info.forEach((v: any) => {
    console.log(v.infos);
  });
};

test();
