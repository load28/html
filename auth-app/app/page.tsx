/**
 * 홈페이지
 */

'use client'

import Link from 'next/link'
import { useAuth } from '@/context/AuthContext'

export default function Home() {
  const { session, status } = useAuth()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-6">
          커스텀 인증 시스템
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Auth.js의 오픈소스를 분석하여 직접 구현한 인증 시스템
        </p>

        <div className="bg-white rounded-lg shadow-xl p-8 mb-8">
          <h2 className="text-2xl font-semibold mb-4">구현 내용</h2>
          <ul className="text-left space-y-2 text-gray-700">
            <li>✅ Auth.js 소스코드 분석 (packages/core)</li>
            <li>✅ JWT 인코딩/디코딩 (jose, HKDF 키 파생)</li>
            <li>✅ 세션 관리 및 자동 갱신</li>
            <li>✅ 쿠키 기반 토큰 저장 (httpOnly, secure)</li>
            <li>✅ Credentials Provider 구현</li>
            <li>✅ Next.js 미들웨어 라우트 보호</li>
            <li>✅ React Context 세션 관리</li>
            <li>✅ Zod 입력 검증</li>
          </ul>
        </div>

        {status === 'loading' && (
          <div className="text-gray-600">로딩 중...</div>
        )}

        {status === 'authenticated' && session && (
          <div className="space-y-4">
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
              <p className="font-semibold">
                {session.user.email}님, 환영합니다!
              </p>
            </div>
            <Link
              href="/dashboard"
              className="inline-block px-8 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition"
            >
              대시보드로 이동
            </Link>
          </div>
        )}

        {status === 'unauthenticated' && (
          <div className="space-y-4">
            <Link
              href="/login"
              className="inline-block px-8 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition"
            >
              로그인하기
            </Link>
          </div>
        )}

        <div className="mt-12 text-sm text-gray-500">
          <p>
            분석한 Auth.js 패키지:{' '}
            <code className="bg-gray-200 px-2 py-1 rounded">@auth/core</code>
          </p>
        </div>
      </div>
    </div>
  )
}
