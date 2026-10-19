import { adminDb } from "@/lib/firebase/admin";
import { getRegionLockStatus } from "@/lib/regionLock";

export type BranchContext = {
  branchId: string;
  branchName: string;
  branchType: string;
  regionId: string;
  regionName: string;
  roundId: string;
  roundName: string;
  isRegionSubmitted: boolean;
  isRegionClosed: boolean;
};

/**
 * 공유 링크(/s)에서 지역본부 -> 지점/대리점을 선택한 branchId를 검증하고,
 * 현재 진행중인 라운드 기준 컨텍스트(잠금 상태 포함)를 반환한다. 로그인/토큰이
 * 없으므로 branchId 자체가 추측 가능해도 노출되는 정보는 "그 지점의 제작물
 * 목록"뿐이라 민감도가 낮다 (설계 결정: 개별 토큰 대신 지역본부별 공유 링크
 * + 목록 선택 방식). 지점 경로의 모든 API Route는 이 함수를 거쳐야 하며,
 * 브라우저는 Firebase 설정값을 전혀 모른다 (Admin SDK로만 조회).
 */
export async function resolveBranchContext(
  branchId: string
): Promise<BranchContext | null> {
  const branchSnap = await adminDb.collection("branches").doc(branchId).get();
  if (!branchSnap.exists) return null;
  const branch = branchSnap.data()!;
  if (!branch.isActive) return null;

  const regionSnap = await adminDb.collection("regions").doc(branch.regionId).get();
  const regionName = regionSnap.exists ? regionSnap.data()!.name : "";

  const roundSnap = await adminDb
    .collection("rounds")
    .where("status", "==", "진행중")
    .limit(1)
    .get();
  if (roundSnap.empty) return null;
  const roundDoc = roundSnap.docs[0];

  const lock = await getRegionLockStatus(roundDoc.id, branch.regionId);

  return {
    branchId,
    branchName: branch.name,
    branchType: branch.branchType,
    regionId: branch.regionId,
    regionName,
    roundId: roundDoc.id,
    roundName: roundDoc.data().name,
    isRegionSubmitted: lock.isSubmitted,
    isRegionClosed: lock.isClosed,
  };
}
