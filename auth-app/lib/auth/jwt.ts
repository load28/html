/**
 * JWT 유틸리티 - Auth.js의 jwt.ts를 분석하여 직접 구현
 *
 * Auth.js는 A256CBC-HS512 암호화를 사용하지만,
 * 여기서는 더 간단한 HS256 서명 방식을 사용합니다.
 * 실제 프로덕션에서는 Auth.js처럼 JWE(암호화된 JWT)를 사용하는 것을 권장합니다.
 */

import { SignJWT, jwtVerify } from 'jose'
import { hkdf } from '@panva/hkdf'
import type { JWT } from './types'

const DEFAULT_MAX_AGE = 30 * 24 * 60 * 60 // 30일 (초 단위)

/**
 * Auth.js처럼 HKDF를 사용하여 시크릿 키에서 서명 키를 파생
 */
async function getDerivedSigningKey(
  secret: string,
  salt: string
): Promise<Uint8Array> {
  return await hkdf(
    'sha256',
    secret,
    salt,
    `Custom Auth Generated Signing Key (${salt})`,
    32 // 256 bits for HS256
  )
}

/**
 * JWT 인코딩 (Auth.js의 encode 함수 참고)
 * Auth.js는 EncryptJWT를 사용하지만, 여기서는 SignJWT 사용
 */
export async function encodeJWT(params: {
  token?: JWT
  secret: string
  maxAge?: number
  salt: string
}): Promise<string> {
  const { token = {}, secret, maxAge = DEFAULT_MAX_AGE, salt } = params

  const signingKey = await getDerivedSigningKey(secret, salt)

  return await new SignJWT(token)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + maxAge)
    .setJti(crypto.randomUUID())
    .sign(signingKey)
}

/**
 * JWT 디코딩 (Auth.js의 decode 함수 참고)
 */
export async function decodeJWT(params: {
  token?: string
  secret: string
  salt: string
}): Promise<JWT | null> {
  const { token, secret, salt } = params

  if (!token) return null

  try {
    const signingKey = await getDerivedSigningKey(secret, salt)

    const { payload } = await jwtVerify(token, signingKey, {
      algorithms: ['HS256'],
    })

    return payload as JWT
  } catch (error) {
    console.error('JWT verification failed:', error)
    return null
  }
}

/**
 * 쿠키 또는 Authorization 헤더에서 JWT 토큰 추출
 * Auth.js의 getToken 함수를 참고하여 구현
 */
export async function getToken(params: {
  req: Request
  secret: string
  cookieName: string
  salt?: string
  raw?: boolean
}): Promise<JWT | string | null> {
  const { req, secret, cookieName, salt = cookieName, raw = false } = params

  // 쿠키에서 토큰 추출
  const cookies = req.headers.get('cookie') || ''
  const cookieToken = parseCookie(cookies, cookieName)

  // Authorization 헤더에서 Bearer 토큰 추출
  let token = cookieToken
  if (!token) {
    const authHeader = req.headers.get('authorization')
    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7)
    }
  }

  if (!token) return null

  // raw 모드면 토큰 문자열 그대로 반환
  if (raw) return token

  // JWT 디코딩
  return await decodeJWT({ token, secret, salt })
}

/**
 * 간단한 쿠키 파서 (Auth.js는 vendored cookie 라이브러리 사용)
 */
function parseCookie(cookieString: string, name: string): string | null {
  const cookies = cookieString.split(';').map(c => c.trim())

  for (const cookie of cookies) {
    const [key, ...valueParts] = cookie.split('=')
    if (key === name) {
      return valueParts.join('=')
    }
  }

  return null
}
