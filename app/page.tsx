import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center space-y-4">
        <h1 className="text-xl font-bold">BMS 전수조사 시스템</h1>
        <p className="text-gray-500 text-sm">
          지점/대리점 직원분은 아래 링크에서 소속 지역본부와 지점/대리점을 선택해주세요.
        </p>
        <Link
          href="/s"
          className="inline-block bg-gray-900 text-white rounded-lg px-6 py-2 font-medium"
        >
          지점/대리점 바로가기
        </Link>
        <div>
          <Link href="/login" className="text-sm text-blue-600 underline">
            지역본부 · 본사 로그인
          </Link>
        </div>
      </div>
    </div>
  );
}
