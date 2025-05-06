import { NextResponse } from 'next/server';
import { MilvusClient } from '@zilliz/milvus2-sdk-node';

const address = process.env.NEXT_PUBLIC_MILVUS_ADDRESS || '127.0.0.1:19530';
const token = process.env.NEXT_PUBLIC_MILVUS_TOKEN || undefined;

export async function POST(request: Request) {
  try {
    const { collectionName } = await request.json();
    const milvusClient = new MilvusClient(
      token ? { address, token } : { address }
    );

    // Use a random vector for search
    const searchVector = [
      Math.random(),
      Math.random(),
      Math.random(),
      Math.random(),
    ];

    const result = await milvusClient.search({
      collection_name: collectionName,
      data: searchVector,
      output_fields: ['*'],
    });

    return NextResponse.json({ result });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
