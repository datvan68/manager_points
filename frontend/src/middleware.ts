import { NextResponse, type NextRequest } from 'next/server';

const APP_SHELL_CACHE_CONTROL = 'private, no-cache, no-store, max-age=0, must-revalidate';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  response.headers.set('Cache-Control', APP_SHELL_CACHE_CONTROL);

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
