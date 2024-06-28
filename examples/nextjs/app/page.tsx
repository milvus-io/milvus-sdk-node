import { MilvusClient } from '@zilliz/milvus2-sdk-node';

async function getData() {
  const milvusClient = new MilvusClient({
    address: 'localhost:19530',
  });

  let res: any = await milvusClient.getMetric({
    request: { metric_type: 'system_info' },
  });

  const result = res.response.nodes_info.map((v: any) => {
    return v.infos;
  });

  return result;
}

export default async function Home() {
  const data = await getData();

  return <>{JSON.stringify(data)}</>;
}
