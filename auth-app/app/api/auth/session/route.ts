/**
 * 세션 조회 API - Auth.js의 session 액션을 참고하여 구현
 *
 * Auth.js의 /api/auth/session 엔드포인트와 동일한 기능:
 * 1. JWT 디코딩
 * 2. callbacks.jwt() 실행 (토큰 갱신)
 * 3. callbacks.session() 실행 (세션 데이터 필터링)
 * 4. JWT 만료 시간 갱신
 */

import { NextRequest, NextResponse } from 'next/server'
import { authConfig } from '@/lib/auth/config'
import { getSession, getExpiryDate } from '@/lib/auth/session'
import { encodeJWT, getToken } from '@/lib/auth/jwt'
import { createSessionCookie } from '@/lib/auth/cookie'

export async function GET(request: NextRequest) {
  try {
    // 1. 현재 세션 가져오기
    const session = await getSession({
      req: request,
      secret: authConfig.secret,
      cookieName: authConfig.cookies.sessionToken.name,
    })

    // 세션이 없으면 null 반환
    if (!session) {
      return NextResponse.json(
        { session: null },
        {
          headers: {
            'Content-Type': 'application/json',
            // Auth.js처럼 캐시 방지 헤더 설정
            'Cache-Control': 'private, no-cache, no-store, max-age=0',
            Expires: '0',
            Pragma: 'no-cache',
          },
        }
      )
    }

    // 2. JWT 토큰 가져오기 (갱신을 위해)
    const token = await getToken({
      req: request,
      secret: authConfig.secret,
      cookieName: authConfig.cookies.sessionToken.name,
    })

    if (!token || typeof token === 'string') {
      return NextResponse.json({ session: null })
    }

    // 3. JWT 만료 시간 갱신 (Auth.js의 자동 갱신 기능)
    const newToken = await encodeJWT({
      token,
      secret: authConfig.secret,
      maxAge: authConfig.session.maxAge,
      salt: authConfig.cookies.sessionToken.name,
    })

    const newExpires = getExpiryDate(authConfig.session.maxAge)

    // 4. 갱신된 세션 쿠키 생성
    const sessionCookie = createSessionCookie(
      authConfig.cookies.sessionToken.name,
      newToken,
      authConfig.cookies.sessionToken.options,
      authConfig.session.maxAge
    )

    // 5. 세션 데이터 반환 (쿠키 갱신 포함)
    const response = NextResponse.json({
      session: {
        ...session,
        expires: newExpires.toISOString(),
      },
    })

    response.headers.set('Set-Cookie', sessionCookie)
    response.headers.set('Cache-Control', 'private, no-cache, no-store, max-age=0')
    response.headers.set('Expires', '0')
    response.headers.set('Pragma', 'no-cache')

    return response
  } catch (error) {
    console.error('Session error:', error)
    return NextResponse.json({ session: null })
  }
}
