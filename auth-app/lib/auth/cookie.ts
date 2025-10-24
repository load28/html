/**
 * 쿠키 관리 유틸리티 - Auth.js의 cookie.ts를 참고하여 구현
 */

import type { AuthConfig } from './types'

/**
 * Auth.js의 defaultCookies 함수를 참고
 * HTTPS 사용 시 __Secure- 접두사 사용
 */
export function getDefaultCookies(useSecureCookies: boolean): AuthConfig['cookies'] {
  const cookiePrefix = useSecureCookies ? '__Secure-' : ''

  return {
    sessionToken: {
      name: `${cookiePrefix}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: useSecureCookies,
      },
    },
  }
}

/**
 * 쿠키 직렬화 (Set-Cookie 헤더 형식)
 */
export function serializeCookie(
  name: string,
  value: string,
  options: {
    httpOnly?: boolean
    sameSite?: 'lax' | 'strict' | 'none'
    path?: string
    secure?: boolean
    maxAge?: number
    expires?: Date
  }
): string {
  const parts = [`${name}=${value}`]

  if (options.httpOnly) parts.push('HttpOnly')
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`)
  if (options.path) parts.push(`Path=${options.path}`)
  if (options.secure) parts.push('Secure')
  if (options.maxAge) parts.push(`Max-Age=${options.maxAge}`)
  if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`)

  return parts.join('; ')
}

/**
 * 세션 쿠키 생성
 */
export function createSessionCookie(
  cookieName: string,
  token: string,
  options: AuthConfig['cookies']['sessionToken']['options'],
  maxAge: number
): string {
  return serializeCookie(cookieName, token, {
    ...options,
    maxAge,
    expires: new Date(Date.now() + maxAge * 1000),
  })
}

/**
 * 쿠키 삭제 (만료 시간을 과거로 설정)
 */
export function clearSessionCookie(
  cookieName: string,
  options: AuthConfig['cookies']['sessionToken']['options']
): string {
  return serializeCookie(cookieName, '', {
    ...options,
    maxAge: 0,
    expires: new Date(0),
  })
}
