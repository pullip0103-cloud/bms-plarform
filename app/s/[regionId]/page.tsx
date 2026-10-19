import BranchListClient from "./BranchListClient";

// 지역본부별 지점 목록은 매번 서버에서 실제 데이터를 조회해야 하는 완전 동적
// 페이지라 빌드 시 정적으로 미리 생성하지 않는다.
export const instant = false;

export default async function BranchListPage({
  params,
}: {
  params: Promise<{ regionId: string }>;
}) {
  const { regionId } = await params;
  return <BranchListClient regionId={regionId} />;
}
