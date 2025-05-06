import { NextResponse } from 'next/server';
import { MilvusClient } from '@zilliz/milvus2-sdk-node';

const address = process.env.NEXT_PUBLIC_MILVUS_ADDRESS || '127.0.0.1:19530';
const token = process.env.NEXT_PUBLIC_MILVUS_TOKEN || undefined;

export async function POST(request: Request) {
  const { collectionName } = await request.json();
  const milvusClient = new MilvusClient(
    token ? { address, token } : { address }
  );
  const result = await milvusClient.dropCollection({
    collection_name: collectionName,
  });
  return NextResponse.json({ result });
}
