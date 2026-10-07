import { NextResponse, type NextRequest } from 'next/server';

// UI gate: logged-out visitors only see /login and /register. Everything else (including "/") redirects to /login.
// "eh_session" is a flag cookie set by the client after login (see lib/api.ts). It only decides which page to show;
// real security (JWT checks, roles) is enforced by the API.
const AUTH_PAGES = ['/login', '/register'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const loggedIn = req.cookies.has('eh_session');
  const isAuthPage = AUTH_PAGES.includes(pathname);

  console.log(isAuthPage)

  if (!loggedIn && !isAuthPage) return NextResponse.redirect(new URL('/login', req.url));
  if (loggedIn && isAuthPage) return NextResponse.redirect(new URL('/', req.url));
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
