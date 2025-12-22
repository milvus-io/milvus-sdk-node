import { NextResponse } from 'next/server';
import { getMilvusClient } from '@/lib/milvus-client';

// GET: list collections
export async function GET() {
  try {
    const milvusClient = getMilvusClient();
    const collections = await milvusClient.showCollections();
    return NextResponse.json({ collections: collections.data });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch collections' },
      { status: 500 }
    );
  }
}
