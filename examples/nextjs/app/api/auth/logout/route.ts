import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const response = NextResponse.redirect(new URL('/login', request.url));
  
  // Clear all auth cookies
  response.cookies.delete('clientId');
  response.cookies.delete('milvus_address');
  response.cookies.delete('milvus_token');
  
  return response;
}

