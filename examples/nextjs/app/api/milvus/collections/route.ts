import { NextResponse } from 'next/server';
import { MilvusClient, IndexType, DataType } from '@zilliz/milvus2-sdk-node';

const address = process.env.NEXT_PUBLIC_MILVUS_ADDRESS || '127.0.0.1:19530';
const token = process.env.NEXT_PUBLIC_MILVUS_TOKEN || undefined;

// GET: list collections
export async function GET() {
  const milvusClient = new MilvusClient(
    token ? { address, token } : { address }
  );
  const collections = await milvusClient.showCollections();
  return NextResponse.json({ collections: collections.data });
}

// POST: create a collection
export async function POST(request: Request) {
  const milvusClient = new MilvusClient(
    token ? { address, token } : { address }
  );
  let collectionName = `demo_collection_${Date.now()}`;
  try {
    const body = await request.json();
    if (body.collectionName && typeof body.collectionName === 'string') {
      collectionName = body.collectionName;
    }
  } catch {
    // ignore if no body
  }
  const result = await milvusClient.createCollection({
    collection_name: collectionName,
    fields: [
      {
        name: 'id',
        description: 'ID field',
        data_type: DataType.Int64, // Int64
        is_primary_key: true,
        autoID: true,
      },
      {
        name: 'vector',
        description: 'Vector field',
        data_type: DataType.FloatVector, // FloatVector
        dim: 4,
      },
    ],
  });

  // create index for the vector field
  await milvusClient.createIndex({
    collection_name: collectionName,
    field_name: 'vector',
    index_name: 'ivf_flat',
    index_type: IndexType.AUTOINDEX, // IVF_FLAT
  });

  // load the collection
  await milvusClient.loadCollection({ collection_name: collectionName });

  return NextResponse.json({result});
}
