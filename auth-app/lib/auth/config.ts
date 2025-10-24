/**
 * 인증 설정 - Auth.js 스타일
 */

import { getDefaultCookies } from './cookie'
import type { AuthConfig } from './types'

const isProduction = process.env.NODE_ENV === 'production'

export const authConfig: AuthConfig = {
  // 프로덕션에서는 반드시 환경변수 사용!
  secret: process.env.AUTH_SECRET || 'super-secret-key-change-in-production',

  session: {
    maxAge: 30 * 24 * 60 * 60, // 30일 (Auth.js 기본값)
  },

  cookies: getDefaultCookies(isProduction),
}
