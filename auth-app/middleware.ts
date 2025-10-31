/**
 * Next.js 미들웨어 - 라우트 보호
 *
 * Auth.js는 미들웨어에서 세션을 확인하고 보호된 페이지로의 접근을 제어합니다.
 * 여기서도 동일한 패턴을 구현합니다.
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { authConfig } from '@/lib/auth/config'

// 보호된 경로 설정
const protectedRoutes = ['/dashboard', '/profile', '/settings']
const authRoutes = ['/login', '/register']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 세션 확인
  const session = await getSession({
    req: request,
    secret: authConfig.secret,
    cookieName: authConfig.cookies.sessionToken.name,
  })

  const isAuthenticated = !!session

  // 보호된 라우트 접근 시도
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  )

  if (isProtectedRoute && !isAuthenticated) {
    // 인증되지 않은 경우 로그인 페이지로 리다이렉트
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // 인증 페이지 접근 시도 (이미 로그인된 경우)
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route))

  if (isAuthRoute && isAuthenticated) {
    // 이미 로그인된 경우 홈으로 리다이렉트
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next()
}

// 미들웨어가 실행될 경로 설정
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
