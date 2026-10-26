import BranchClient from "./BranchClient";

// 지점 화면은 branchId별로 매번 실제 데이터를 조회해야 하는 완전 동적 페이지라
// 빌드 시 정적으로 미리 생성하지 않는다.
export const instant = false;

export default async function BranchPage({
  params,
  searchParams,
}: {
  params: Promise<{ regionId: string; branchId: string }>;
  searchParams: Promise<{ roundId?: string }>;
}) {
  const { regionId, branchId } = await params;
  const { roundId } = await searchParams;
  return <BranchClient regionId={regionId} branchId={branchId} roundId={roundId ?? null} />;
}
