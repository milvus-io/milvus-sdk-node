import { MilvusClient } from '@zilliz/milvus2-sdk-node';

async function getData(address: string) {
  const milvusClient = new MilvusClient({
    address,
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
  const address = `127.0.0.1:19530`;

  const data = await getData(address);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="max-w-4xl w-full p-6 bg-white rounded-lg shadow-md">
        <h1 className="text-3xl font-bold text-center mb-4">
          Welcome to Milvus
        </h1>
        <h2 className="text-xl font-bold text-center mb-4">{address}</h2>

        <div className="bg-gray-50 p-4 rounded-lg">
          <pre className="whitespace-pre-wrap text-sm text-gray-800">
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
