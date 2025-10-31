/**
 * 로그인 API - Auth.js의 callback 핸들러를 참고하여 구현
 *
 * Auth.js의 credentials provider 흐름:
 * 1. authorize() 함수로 사용자 인증
 * 2. callbacks.jwt() 호출하여 JWT 토큰 생성
 * 3. jwt.encode()로 암호화
 * 4. 쿠키에 저장
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { authConfig } from '@/lib/auth/config'
import { encodeJWT } from '@/lib/auth/jwt'
import { createSessionCookie } from '@/lib/auth/cookie'
import { getExpiryDate } from '@/lib/auth/session'
import type { User, JWT } from '@/lib/auth/types'

// 로그인 요청 검증 스키마
const loginSchema = z.object({
  email: z.string().email('유효한 이메일을 입력하세요'),
  password: z.string().min(6, '비밀번호는 최소 6자 이상이어야 합니다'),
})

/**
 * 실제 애플리케이션에서는 데이터베이스에서 사용자 조회
 * 여기서는 데모용 하드코딩 사용자
 */
const DEMO_USERS = [
  {
    id: '1',
    email: 'user@example.com',
    name: 'Demo User',
    // 비밀번호: "password123" (bcrypt 해시)
    passwordHash: '$2b$10$Lj3VsAIuH89BvzQ5hpcdDOrg3.p1zUgM0i760Bq1Tz2SnqUlrFaUe',
  },
]

/**
 * Auth.js의 authorize() 함수를 모방
 * credentials를 받아 User 객체 반환하거나 null 반환
 */
async function authorize(credentials: {
  email: string
  password: string
}): Promise<User | null> {
  // 실제로는 데이터베이스에서 조회
  const user = DEMO_USERS.find((u) => u.email === credentials.email)

  if (!user) {
    return null
  }

  // 비밀번호 검증
  const isValid = await bcrypt.compare(credentials.password, user.passwordHash)

  if (!isValid) {
    return null
  }

  // User 객체 반환
  return {
    id: user.id,
    email: user.email,
    name: user.name,
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. 요청 바디 파싱 및 검증 (Auth.js도 입력 검증 권장)
    const body = await request.json()
    const result = loginSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Invalid credentials', details: result.error.errors },
        { status: 400 }
      )
    }

    const { email, password } = result.data

    // 2. authorize() 함수 호출 (Auth.js credentials provider와 동일)
    const user = await authorize({ email, password })

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // 3. JWT 토큰 생성 (Auth.js의 callbacks.jwt() 단계)
    const defaultToken: JWT = {
      name: user.name,
      email: user.email,
      picture: user.image,
      sub: user.id, // subject (user id)
    }

    // 4. JWT 인코딩 (Auth.js의 jwt.encode() 단계)
    const token = await encodeJWT({
      token: defaultToken,
      secret: authConfig.secret,
      maxAge: authConfig.session.maxAge,
      salt: authConfig.cookies.sessionToken.name,
    })

    // 5. 세션 쿠키 생성
    const sessionCookie = createSessionCookie(
      authConfig.cookies.sessionToken.name,
      token,
      authConfig.cookies.sessionToken.options,
      authConfig.session.maxAge
    )

    // 6. 응답 반환 (쿠키 포함)
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    })

    response.headers.set('Set-Cookie', sessionCookie)

    return response
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
