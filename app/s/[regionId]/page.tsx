import { notFound } from "next/navigation";
import { connection } from "next/server";
import { resolveRegion } from "@/lib/authz";
import { adminDb } from "@/lib/firebase/admin";
import BranchListClient, { type RoundOption } from "./BranchListClient";

// 지역본부별 지점 목록은 매번 서버에서 실제 데이터를 조회해야 하는 완전 동적
// 페이지라 빌드 시 정적으로 미리 생성하지 않는다.
export const instant = false;

export default async function BranchListPage({
  params,
  searchParams,
}: {
  params: Promise<{ regionId: string }>;
  searchParams: Promise<{ roundId?: string }>;
}) {
  await connection();
  const { regionId } = await params;
  const { roundId } = await searchParams;
  const region = await resolveRegion(regionId);
  if (!region) notFound();

  const roundsSnap = await adminDb.collection("rounds").orderBy("createdAt", "desc").get();
  const rounds: RoundOption[] = roundsSnap.docs.map((d) => ({
    id: d.id,
    name: d.data().name as string,
    status: d.data().status as string,
  }));
  const selectedRoundId =
    (roundId && rounds.find((r) => r.id === roundId)?.id) ||
    rounds.find((r) => r.status === "진행중")?.id ||
    null;

  return (
    <BranchListClient
      regionId={regionId}
      regionName={region.name}
      rounds={rounds}
      selectedRoundId={selectedRoundId}
    />
  );
}
