import { NextResponse } from 'next/server';
import { getMilvusClient } from '@/lib/milvus-client';
import { DataType } from '@zilliz/milvus2-sdk-node';

const DEFAULT_COLLECTION_NAME = 'default_collection';

export async function POST() {
  try {
    const milvusClient = getMilvusClient();

    const hasCollection = await milvusClient.hasCollection({
      collection_name: DEFAULT_COLLECTION_NAME,
    });

    if (hasCollection.value) {
      return NextResponse.json({
        message: 'Collection already exists',
        collection_name: DEFAULT_COLLECTION_NAME,
      });
    }

    await milvusClient.createCollection({
      collection_name: DEFAULT_COLLECTION_NAME,
      fields: [
        {
          name: 'id',
          description: 'ID field',
          data_type: DataType.Int64,
          is_primary_key: true,
          autoID: true,
        },
        {
          name: 'vector',
          description: 'Vector field',
          data_type: DataType.FloatVector,
          dim: 4,
        },
      ],
    });

    await milvusClient.createIndex({
      collection_name: DEFAULT_COLLECTION_NAME,
      field_name: 'vector',
      metric_type: 'L2',
    });

    await milvusClient.loadCollectionSync({
      collection_name: DEFAULT_COLLECTION_NAME,
    });

    return NextResponse.json({
      message: 'Collection created successfully',
      collection_name: DEFAULT_COLLECTION_NAME,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to initialize collection' },
      { status: 500 }
    );
  }
}

