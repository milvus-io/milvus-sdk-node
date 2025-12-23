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
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const result = await client.query({
      collectionName,
      dbName,
      limit,
      offset,
      outputFields: ['*'],
    });
    
    // Zilliz Cloud API returns { code: 0, data: [...] }
    // result.data is already the array of records
    const data = Array.isArray(result.data) ? result.data : [];
    
    // Total count - use array length as total (might not be accurate for pagination)
    const total = data.length;

    return NextResponse.json({ data, total, limit, offset });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to fetch collection data' },
      { status: 500 }
    );
  }
}

