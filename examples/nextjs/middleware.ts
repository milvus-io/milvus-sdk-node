import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const clientId = request.cookies.get('clientId')?.value;
  const { pathname } = request.nextUrl;

  // Handle root path redirect
  if (pathname === '/') {
    if (clientId) {
      return NextResponse.redirect(new URL('/databases', request.url));
    } else {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // Allow access to login page - don't redirect if already authenticated
  // Let the page handle it to avoid loops with invalid cookies
  if (pathname === '/login') {
    return NextResponse.next();
  }

  // Protect other routes - require authentication cookie
  // Note: We only check cookie existence here, not validity
  // Pages will handle invalid cookies and redirect appropriately
  if (!clientId) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};

