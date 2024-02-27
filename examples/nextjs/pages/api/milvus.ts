import type { NextApiRequest, NextApiResponse } from 'next';
import { MilvusClient } from '@zilliz/milvus2-sdk-node';

async function getData() {
  const milvusClient = new MilvusClient({
    address: '10.102.6.196:19530',
  });

  let res: any = await milvusClient.getMetric({
    request: { metric_type: 'system_info' },
  });

  const result = res.response.nodes_info.map((v: any) => {
    return v.infos;
  });

  return result;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const data = await getData();
  res.status(200).json(data);
}
