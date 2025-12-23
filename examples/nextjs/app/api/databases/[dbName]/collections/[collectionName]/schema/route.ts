import { NextRequest, NextResponse } from 'next/server';
import { getOrRecreateClient } from '@/lib/milvus-client';
import { cookies } from 'next/headers';

export async function GET(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ dbName: string; collectionName: string }> }
) {
  try {
    const { dbName, collectionName } = await params;
    const cookieStore = await cookies();
    const clientId = cookieStore.get('clientId')?.value;

    if (!clientId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Get address and token from cookies to recreate client if needed
    const addressCookie = cookieStore.get('milvus_address')?.value;
    const tokenCookie = cookieStore.get('milvus_token')?.value;
    
    if (!addressCookie || !tokenCookie) {
      return NextResponse.json(
        { error: 'Session expired. Please reconnect.' },
        { status: 401 }
      );
    }
    
    const address = Buffer.from(addressCookie, 'base64').toString('utf-8');
    const token = Buffer.from(tokenCookie, 'base64').toString('utf-8');
    
    const client = await getOrRecreateClient(clientId, address, token);
    
    if (!client) {
      return NextResponse.json(
        { error: 'Failed to create client. Please reconnect.' },
        { status: 401 }
      );
    }

    const result = await client.describeCollection({
      collectionName,
      dbName,
    });
    
    // Zilliz Cloud API returns { code: 0, data: {...} }
    const schema = result.data || result;

    return NextResponse.json({ schema });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch collection schema' },
      { status: 500 }
    );
  }
}

