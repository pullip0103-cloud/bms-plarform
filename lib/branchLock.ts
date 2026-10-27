import { adminDb } from "@/lib/firebase/admin";

export type LockProcess = "submission" | "action";

/**
 * 라운드별·지점별, 프로세스별(제작물 전송/처리결과 입력) "마감" 상태.
 * 지점이 등록을 마쳤다고 스스로 표시하는 용도이며, 지역본부/본사가 아직
 * 잠그지 않았다면 "수정" 버튼으로 언제든 되돌릴 수 있다 (lib/regionLock.ts의
 * 지역본부/본사 마감과 같은 구조, 문서 ID만 `${roundId}_${branchId}`로 지점 단위).
 */
export function branchLockDocId(roundId: string, branchId: string) {
  return `${roundId}_${branchId}`;
}

function fieldFor(process: LockProcess) {
  return process === "submission" ? "submissionCompleted" : "actionCompleted";
}

export async function getBranchCompletionStatus(
  roundId: string,
  branchId: string,
  process: LockProcess
): Promise<boolean> {
  const snap = await adminDb
    .collection("roundBranchStatus")
    .doc(branchLockDocId(roundId, branchId))
    .get();
  return snap.data()?.[fieldFor(process)] === true;
}

export async function getBranchCompletionStatuses(
  roundId: string,
  branchId: string
): Promise<{ submissionCompleted: boolean; actionCompleted: boolean }> {
  const snap = await adminDb
    .collection("roundBranchStatus")
    .doc(branchLockDocId(roundId, branchId))
    .get();
  const data = snap.data();
  return {
    submissionCompleted: data?.submissionCompleted === true,
    actionCompleted: data?.actionCompleted === true,
  };
}

/**
 * 이 라운드에서 해당 프로세스가 "마감" 표시된 branchId 전체를 조회한다.
 * `regionId`를 지정하면 그 지역본부 소속 지점만(지역본부 화면·지역본부
 * 마감 토글용 — 소속 지점 전원이 마감했는지 확인하는 데 쓴다), 생략하면
 * 전국 전체(본사 관리설정의 "지역본부별 마감 현황" — 13개 지역본부를 한
 * 화면에서 다 봐야 하므로 지역본부별로 13번 나눠 조회하는 것보다 한 번에
 * 전국을 조회하는 쪽이 왕복 횟수가 적어 더 유리함).
 *
 * `regionId` 없이 roundId만으로 걸렀던 이전 버전은 **지역본부 화면
 * 하나(`/r/{regionId}`)를 새로고침할 때마다도** 전국 모든 지역본부의
 * 지점 상태를 전부 읽어와, 전국 운영 규모(13개 지역본부·517개 지점)에서
 * Firestore 읽기량이 10배 넘게 낭비되는 버그였다(2026-10-27 발견, 배포 전
 * 부하 점검 중 — 지역본부 직원들이 새로고침만 몇 번 눌러도 Firestore
 * 무료 일일한도를 초과할 수 있는 수준). `roundBranchStatus` 문서에 이미
 * regionId가 저장돼 있어 바로 필터링 가능하고, 3필드 동등비교 조합은
 * Firestore 복합 인덱스 없이도 동작함을 직접 확인했다.
 */
export async function getCompletedBranchIds(
  roundId: string,
  regionId: string | null,
  process: LockProcess
): Promise<Set<string>> {
  let query = adminDb
    .collection("roundBranchStatus")
    .where("roundId", "==", roundId)
    .where(fieldFor(process), "==", true);
  if (regionId) {
    query = query.where("regionId", "==", regionId);
  }
  const snap = await query.get();
  return new Set(snap.docs.map((d) => d.data().branchId as string));
}
