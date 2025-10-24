/**
 * 대시보드 페이지 - 보호된 라우트
 */

'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'

export default function DashboardPage() {
  const router = useRouter()
  const { session, status, update } = useAuth()

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })

      // 세션 갱신
      await update()

      // 홈으로 리다이렉트
      router.push('/')
    } catch (error) {
      console.error('로그아웃 실패:', error)
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">로딩 중...</div>
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">인증되지 않음</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold">대시보드</h1>
            </div>
            <div className="flex items-center">
              <button
                onClick={handleLogout}
                className="ml-4 px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
              >
                로그아웃
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h2 className="text-2xl font-bold mb-4">환영합니다!</h2>
              <div className="space-y-3">
                <p>
                  <span className="font-semibold">이메일:</span> {session?.user.email}
                </p>
                <p>
                  <span className="font-semibold">이름:</span> {session?.user.name || 'N/A'}
                </p>
                <p>
                  <span className="font-semibold">사용자 ID:</span> {session?.user.id}
                </p>
                <p>
                  <span className="font-semibold">세션 만료:</span>{' '}
                  {session?.expires
                    ? new Date(session.expires).toLocaleString('ko-KR')
                    : 'N/A'}
                </p>
              </div>

              <div className="mt-6 p-4 bg-green-50 rounded-md">
                <h3 className="text-lg font-semibold text-green-800 mb-2">
                  인증 성공!
                </h3>
                <p className="text-sm text-green-700">
                  Auth.js의 구조를 분석하여 직접 구현한 커스텀 인증 시스템이 정상적으로
                  작동하고 있습니다.
                </p>
              </div>

              <div className="mt-6 p-4 bg-blue-50 rounded-md">
                <h3 className="text-lg font-semibold text-blue-800 mb-2">
                  구현된 기능
                </h3>
                <ul className="list-disc list-inside text-sm text-blue-700 space-y-1">
                  <li>JWT 기반 세션 관리 (HKDF 키 파생)</li>
                  <li>쿠키 기반 토큰 저장 (httpOnly, secure)</li>
                  <li>자동 세션 갱신</li>
                  <li>미들웨어 기반 라우트 보호</li>
                  <li>React Context를 통한 클라이언트 세션 관리</li>
                  <li>Zod를 이용한 입력 검증</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
