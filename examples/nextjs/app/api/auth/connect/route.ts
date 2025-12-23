import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/milvus-client';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address, token } = body;

    if (!address || !token) {
      return NextResponse.json(
        { error: 'Address and token are required' },
        { status: 400 }
      );
    }

    const { clientId } = createClient(address, token);

    const response = NextResponse.json({ clientId, success: true });
    
    // Set cookies in response headers directly
    // Store clientId, address, and token so we can recreate client if cache is lost
    response.cookies.set('clientId', clientId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });
    
    // Store address and token (encoded) for client recreation
    response.cookies.set('milvus_address', Buffer.from(address).toString('base64'), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });
    
    response.cookies.set('milvus_token', Buffer.from(token).toString('base64'), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return response;
  } catch (error: any) {
    console.error('Auth connect error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to connect' },
      { status: 500 }
    );
  }
}

