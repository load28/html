/**
 * 로그아웃 API - Auth.js의 signout 액션을 참고하여 구현
 *
 * Auth.js의 signout 흐름:
 * 1. 세션 쿠키 삭제
 * 2. 데이터베이스 세션 삭제 (database 전략 사용 시)
 * 3. events.signOut() 호출
 */

import { NextRequest, NextResponse } from 'next/server'
import { authConfig } from '@/lib/auth/config'
import { clearSessionCookie } from '@/lib/auth/cookie'

export async function POST(request: NextRequest) {
  try {
    // 세션 쿠키 삭제 (Auth.js의 sessionStore.clean() 참고)
    const clearCookie = clearSessionCookie(
      authConfig.cookies.sessionToken.name,
      authConfig.cookies.sessionToken.options
    )

    const response = NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    })

    response.headers.set('Set-Cookie', clearCookie)

    return response
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET 요청도 지원 (Auth.js와 동일)
export async function GET(request: NextRequest) {
  return POST(request)
}
