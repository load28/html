/**
 * Auth Context - 클라이언트 사이드 세션 관리
 *
 * Auth.js의 useSession 훅과 SessionProvider를 참고하여 구현
 */

'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import type { Session } from '@/lib/auth/types'

interface AuthContextValue {
  session: Session | null
  status: 'loading' | 'authenticated' | 'unauthenticated'
  update: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

/**
 * Auth.js의 SessionProvider와 동일한 기능
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading')

  const fetchSession = async () => {
    try {
      const response = await fetch('/api/auth/session', {
        credentials: 'include', // 쿠키 포함
      })

      if (response.ok) {
        const data = await response.json()
        if (data.session) {
          setSession(data.session)
          setStatus('authenticated')
        } else {
          setSession(null)
          setStatus('unauthenticated')
        }
      } else {
        setSession(null)
        setStatus('unauthenticated')
      }
    } catch (error) {
      console.error('Failed to fetch session:', error)
      setSession(null)
      setStatus('unauthenticated')
    }
  }

  useEffect(() => {
    fetchSession()

    // Auth.js처럼 주기적으로 세션 갱신 (선택사항)
    // const interval = setInterval(fetchSession, 60000) // 1분마다
    // return () => clearInterval(interval)
  }, [])

  const value: AuthContextValue = {
    session,
    status,
    update: fetchSession,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/**
 * Auth.js의 useSession 훅과 동일한 기능
 */
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
