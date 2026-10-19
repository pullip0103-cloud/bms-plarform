import { adminDb } from "@/lib/firebase/admin";

/**
 * 라운드별·지역본부별 잠금 상태. 문서 ID는 `${roundId}_${regionId}`로 고정해,
 * 라운드가 바뀌면 자동으로 새 잠금 상태(둘 다 false)로 시작한다.
 *
 * - isSubmitted (지역본부가 토글): true가 되면 그 지역본부 소속 지점은
 *   신규 등록/재제출(지역본부 반려건 재업로드)을 할 수 없다. 단, 본사가
 *   지침을 부여한 뒤의 "조치결과 사진 올리기" 단계는 이 잠금의 예외다 —
 *   그 흐름은 지역본부 제출 여부와 무관하게 계속 진행된다.
 * - isClosed (본사가 지역본부 단위로 토글): true가 되면 그 지역본부에 속한
 *   모든 쓰기(지점의 등록/재제출/조치결과 업로드, 지역본부의 승인/반려)가
 *   예외 없이 전부 막힌다. 본사는 전체 라운드가 아니라 지역본부별로 검토가
 *   끝나는 순서대로 마감할 수 있다.
 *
 * 두 상태 모두 같은 버튼을 다시 누르면 해제(토글)할 수 있다.
 */
export type RegionLockStatus = {
  isSubmitted: boolean;
  isClosed: boolean;
};

export function regionLockDocId(roundId: string, regionId: string) {
  return `${roundId}_${regionId}`;
}

export async function getRegionLockStatus(
  roundId: string,
  regionId: string
): Promise<RegionLockStatus> {
  const snap = await adminDb
    .collection("roundRegionStatus")
    .doc(regionLockDocId(roundId, regionId))
    .get();
  const data = snap.data();
  return {
    isSubmitted: data?.isSubmitted === true,
    isClosed: data?.isClosed === true,
  };
}

/** 특정 건(item)이 속한 현재 진행중 라운드 기준으로 그 지역본부가 마감되었는지 확인한다. */
export async function isRegionClosedForItem(regionId: string): Promise<boolean> {
  const roundSnap = await adminDb
    .collection("rounds")
    .where("status", "==", "진행중")
    .limit(1)
    .get();
  if (roundSnap.empty) return false;
  const lock = await getRegionLockStatus(roundSnap.docs[0].id, regionId);
  return lock.isClosed;
}
