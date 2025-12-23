import { NextRequest, NextResponse } from 'next/server';
import { getOrRecreateClient } from '@/lib/milvus-client';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
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

    // Use HttpClient's listDatabases method
    // Note: HttpClient might not have listDatabases, so we'll use direct REST API
    const endpoint = client.config.endpoint || '';
    const authToken = client.config.token || '';

    const response = await fetch(`${endpoint}/v2/vectordb/databases/list`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to fetch databases:', response.status, errorText);
      throw new Error(
        `Failed to fetch databases: ${response.status} ${errorText}`
      );
    }

    const data = await response.json();
    
    // Zilliz Cloud API returns { code: 0, data: [...] }
    let databases = data.data || data.db_names || data.databases || [];
    
    // Sort databases: 'default' first (if exists), then others alphabetically
    const defaultDb = databases.find((db: string) => db === 'default');
    const otherDbs = databases.filter((db: string) => db !== 'default').sort();
    
    databases = defaultDb ? [defaultDb, ...otherDbs] : otherDbs;

    return NextResponse.json({ databases });
  } catch (error: any) {
    console.error('Error in databases route:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch databases' },
      { status: 500 }
    );
  }
}

