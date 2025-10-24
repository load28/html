/**
 * 타입 정의 - Auth.js 구조를 참고하여 구현
 */

export interface User {
  id: string
  email: string
  name?: string | null
  image?: string | null
}

export interface JWT {
  name?: string | null
  email?: string | null
  picture?: string | null
  sub?: string  // user id
  iat?: number  // issued at
  exp?: number  // expires at
  jti?: string  // jwt id
}

export interface Session {
  user: {
    id: string
    email: string
    name?: string | null
    image?: string | null
  }
  expires: string
}

export interface AuthConfig {
  secret: string
  session: {
    maxAge: number  // seconds
  }
  cookies: {
    sessionToken: {
      name: string
      options: {
        httpOnly: boolean
        sameSite: 'lax' | 'strict' | 'none'
        path: string
        secure: boolean
      }
    }
  }
}
