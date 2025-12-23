import { NextRequest, NextResponse } from 'next/server';
import { getOrRecreateClient } from '@/lib/milvus-client';
import { cookies } from 'next/headers';

export async function POST(
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

    const body = await request.json();
    const {
      data,
      annsField,
      limit = 10,
      outputFields = [],
      filter,
      metricType,
      params: searchParams,
    } = body;

    if (!data || !Array.isArray(data) || data.length === 0) {
      return NextResponse.json(
        { error: 'data is required and must be a non-empty array' },
        { status: 400 }
      );
    }

    if (!annsField) {
      return NextResponse.json(
        { error: 'annsField is required' },
        { status: 400 }
      );
    }

    const endpoint = client.config.endpoint || '';
    const authToken = client.config.token || '';

    const searchPayload: any = {
      collectionName,
      dbName,
      data,
      annsField,
      limit,
    };

    if (outputFields && outputFields.length > 0) {
      searchPayload.outputFields = outputFields;
    }

    if (filter) {
      searchPayload.filter = filter;
    }

    if (metricType || searchParams) {
      searchPayload.searchParams = {};
      if (metricType) {
        searchPayload.searchParams.metricType = metricType;
      }
      if (searchParams) {
        searchPayload.searchParams.params = searchParams;
      }
    }

    const response = await fetch(`${endpoint}/v2/vectordb/entities/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify(searchPayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Search API error:', response.status, errorText);
      return NextResponse.json(
        { error: `Search failed: ${response.status} ${errorText}` },
        { status: response.status }
      );
    }

    const result = await response.json();

    // Zilliz Cloud API returns { code: 0, data: [...] }
    const searchResults = result.data || [];

    return NextResponse.json({ results: searchResults });
  } catch (error: any) {
    console.error('Error in search route:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to perform search' },
      { status: 500 }
    );
  }
}

