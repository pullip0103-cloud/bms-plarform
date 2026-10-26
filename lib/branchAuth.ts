import { adminDb } from "@/lib/firebase/admin";
import { getRegionLockStatus } from "@/lib/regionLock";
import { getBranchCompletionStatuses } from "@/lib/branchLock";

export type BranchContext = {
  branchId: string;
  branchName: string;
  branchType: string;
  regionId: string;
  regionName: string;
  roundId: string;
  roundName: string;
  isPastRound: boolean;
  submissionRegionClosed: boolean;
  submissionHqClosed: boolean;
  actionRegionClosed: boolean;
  actionHqClosed: boolean;
  submissionCompleted: boolean;
  actionCompleted: boolean;
};

/**
 * 공유 링크(/s)에서 지역본부 -> 지점/대리점을 선택한 branchId를 검증하고,
 * 라운드 기준 컨텍스트(두 프로세스의 잠금 상태 포함)를 반환한다. `roundId`를
 * 지정하면 그 라운드로 고정 조회하고(과거 라운드 읽기전용 조회용 — 진행중
 * 여부와 무관하게 조회만 허용, 모든 잠금 플래그를 켠 것으로 응고해 내려줌),
 * 생략하면 "현재 진행중 라운드"를 찾는다(기존 동작). 로그인/토큰이 없으므로
 * branchId 자체가 추측 가능해도 노출되는 정보는 "그 지점의 제작물 목록"뿐이라
 * 민감도가 낮다 (설계 결정: 개별 토큰 대신 지역본부별 공유 링크 + 목록 선택
 * 방식). 지점 경로의 모든 API Route는 이 함수를 거쳐야 하며, 브라우저는
 * Firebase 설정값을 전혀 모른다 (Admin SDK로만 조회).
 */
export async function resolveBranchContext(
  branchId: string,
  roundId?: string | null
): Promise<BranchContext | null> {
  const branchSnap = await adminDb.collection("branches").doc(branchId).get();
  if (!branchSnap.exists) return null;
  const branch = branchSnap.data()!;
  if (!branch.isActive) return null;

  const regionSnap = await adminDb.collection("regions").doc(branch.regionId).get();
  const regionName = regionSnap.exists ? regionSnap.data()!.name : "";

  const roundDoc = roundId
    ? await adminDb.collection("rounds").doc(roundId).get()
    : (
        await adminDb.collection("rounds").where("status", "==", "진행중").limit(1).get()
      ).docs[0];
  if (!roundDoc || !roundDoc.exists) return null;

  const isPastRound = roundDoc.data()!.status !== "진행중";

  const lock = await getRegionLockStatus(roundDoc.id, branch.regionId);
  const completion = await getBranchCompletionStatuses(roundDoc.id, branchId);

  return {
    branchId,
    branchName: branch.name,
    branchType: branch.branchType,
    regionId: branch.regionId,
    regionName,
    roundId: roundDoc.id,
    roundName: roundDoc.data()!.name,
    isPastRound,
    // 과거 라운드는 조회만 허용한다 — 실제 잠금 문서 상태와 무관하게 모든
    // 쓰기 관문을 "닫힘"으로 응고해 내려줘서 화면/서버 양쪽에서 수정이
    // 불가능하도록 한다.
    submissionRegionClosed: isPastRound || lock.submissionRegionClosed,
    submissionHqClosed: isPastRound || lock.submissionHqClosed,
    actionRegionClosed: isPastRound || lock.actionRegionClosed,
    actionHqClosed: isPastRound || lock.actionHqClosed,
    submissionCompleted: completion.submissionCompleted,
    actionCompleted: completion.actionCompleted,
  };
}
