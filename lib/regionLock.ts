import { adminDb } from "@/lib/firebase/admin";

export type LockProcess = "submission" | "action";

/**
 * 라운드별·지역본부별 잠금 상태. 문서 ID는 `${roundId}_${regionId}`로 고정해,
 * 라운드가 바뀌면 자동으로 새 잠금 상태(모두 false)로 시작한다.
 *
 * 전수조사에는 시점이 다른 두 프로세스가 있다 — "제작물 전송"(지점이 매장
 * 제작물 사진을 올리는 단계)과 "처리결과 입력"(본사 지침 이후 지점이
 * 조치결과 사진을 올리는 단계). 각 프로세스마다 지역본부/본사 마감이 독립
 * 적으로 존재한다:
 *
 * - submissionRegionClosed / actionRegionClosed (지역본부가 토글): true가
 *   되면 그 지역본부 소속 지점은 해당 프로세스의 쓰기(제작물 등록 또는
 *   조치결과 업로드)를 할 수 없다.
 * - submissionHqClosed / actionHqClosed (본사가 지역본부 단위로 토글):
 *   true가 되면 그 프로세스에 대한 지역본부 자신의 토글도 막힌다(지점은
 *   당연히 막힘).
 * - directivePublished (본사가 지역본부 단위로 토글): 본사가 입력해둔
 *   처리지침 코드를 지역본부/지점 화면에 공개할지 여부. submissionHqClosed가
 *   true일 때만 켤 수 있다(제작물 접수가 확정된 뒤에 지침을 배포한다는
 *   워크플로우 순서).
 *
 * 모든 토글은 같은 버튼을 다시 누르면 해제할 수 있다.
 */
export type RegionLockStatus = {
  submissionRegionClosed: boolean;
  actionRegionClosed: boolean;
  submissionHqClosed: boolean;
  actionHqClosed: boolean;
  directivePublished: boolean;
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
    submissionRegionClosed: data?.submissionRegionClosed === true,
    actionRegionClosed: data?.actionRegionClosed === true,
    submissionHqClosed: data?.submissionHqClosed === true,
    actionHqClosed: data?.actionHqClosed === true,
    directivePublished: data?.directivePublished === true,
  };
}

/** 특정 건(item)이 속한 현재 진행중 라운드 기준으로, 본사가 그 지역본부의
 * 해당 프로세스를 마감했는지 확인한다. */
export async function isHqClosedForItem(
  regionId: string,
  process: LockProcess
): Promise<boolean> {
  const roundSnap = await adminDb
    .collection("rounds")
    .where("status", "==", "진행중")
    .limit(1)
    .get();
  if (roundSnap.empty) return false;
  const lock = await getRegionLockStatus(roundSnap.docs[0].id, regionId);
  return process === "submission" ? lock.submissionHqClosed : lock.actionHqClosed;
}
