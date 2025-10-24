/**
 * 세션 관리 - Auth.js의 session.ts를 참고하여 구현
 */

import { decodeJWT, getToken } from './jwt'
import type { Session, JWT } from './types'

/**
 * JWT 페이로드를 세션 객체로 변환
 * Auth.js의 session 핸들러 로직을 참고
 */
export function jwtToSession(token: JWT): Session | null {
  if (!token.sub) return null

  return {
    user: {
      id: token.sub,
      email: token.email || '',
      name: token.name || null,
      image: token.picture || null,
    },
    expires: token.exp ? new Date(token.exp * 1000).toISOString() : '',
  }
}

/**
 * Request에서 현재 세션 가져오기
 * Auth.js의 getToken + session 로직을 결합
 */
export async function getSession(params: {
  req: Request
  secret: string
  cookieName: string
}): Promise<Session | null> {
  const { req, secret, cookieName } = params

  const token = await getToken({
    req,
    secret,
    cookieName,
    salt: cookieName,
  })

  if (!token || typeof token === 'string') return null

  return jwtToSession(token)
}

/**
 * 만료 시간 계산 (Auth.js의 fromDate 참고)
 */
export function getExpiryDate(maxAge: number): Date {
  return new Date(Date.now() + maxAge * 1000)
}
