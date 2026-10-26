import Link from "next/link";
import { TACTILE_BUTTON } from "@/lib/tactileButton";

// 현재는 남부지역본부 기준으로만 운영한다 (다른 지역본부 확장은 추후 작업).
const NAMBU_REGION_ID = "DldQXEtf1cYJyUAtoVgx";

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="text-center space-y-4">
        <h1 className="text-xl font-bold">BMS 전수조사 시스템</h1>
        <p className="text-gray-500 text-sm">
          지점/대리점 직원분은 아래 링크에서 매장을 선택해주세요.
        </p>
        <Link
          href={`/s/${NAMBU_REGION_ID}`}
          className={`${TACTILE_BUTTON} inline-block bg-gray-900 text-white px-8 py-4 text-base`}
        >
          지점/대리점 바로가기
        </Link>
        <p className="text-xs text-gray-400 pt-4">
          지역본부·본사 담당자는 각자 전달받은 전용 링크로 접속해주세요.
        </p>
      </div>
    </div>
  );
}
