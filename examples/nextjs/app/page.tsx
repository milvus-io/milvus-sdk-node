import { MilvusClient } from '@zilliz/milvus2-sdk-node';

/**
 * This option is equivalent to getServerSideProps() in the pages directory.
 * https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config
 */
export const dynamic = 'force-dynamic';

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

export default async function Home() {
  const data = await getData();

  return <>{JSON.stringify(data)}</>;
}
