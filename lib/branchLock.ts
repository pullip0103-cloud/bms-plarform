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
 * 이 라운드에서 해당 프로세스가 "마감" 표시된 branchId 전체를 한 번에 조회한다.
 * 지역본부가 그 프로세스의 지역본부 마감을 켜기 전에, 소속 지점 전원이
 * 마감했는지 확인하는 데 쓴다.
 */
export async function getCompletedBranchIds(
  roundId: string,
  process: LockProcess
): Promise<Set<string>> {
  const snap = await adminDb
    .collection("roundBranchStatus")
    .where("roundId", "==", roundId)
    .where(fieldFor(process), "==", true)
    .get();
  return new Set(snap.docs.map((d) => d.data().branchId as string));
}
