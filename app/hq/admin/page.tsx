import { connection } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getRegionLockStatus } from "@/lib/regionLock";
import { getCompletedBranchIds } from "@/lib/branchLock";
import { fetchAllActiveBranches } from "@/lib/activeBranches";
import AdminBoard, { type AdminBranch, type RegionStatus } from "./AdminBoard";

export const instant = false;

export default async function AdminPage() {
  await connection();
  // 지점/대리점용(/s)·지역본부용(/r)·본사용(/hq/{regionId})과 동일한
  // 헬퍼(lib/activeBranches.ts)로 조회해, 네 화면이 항상 같은 기준(isActive==true)을
  // 쓰게 한다 — 여기서만 필터를 깜빡해 삭제된 지점이 계속 보이던 버그가 있었다.
  const [roundsSnap, regionsSnap, branchDocs] = await Promise.all([
    adminDb.collection("rounds").orderBy("createdAt", "desc").get(),
    adminDb.collection("regions").orderBy("name").get(),
    fetchAllActiveBranches(),
  ]);

  // Firestore Timestamp(createdAt 등)는 클래스 인스턴스라 서버->클라이언트 컴포넌트로
  // 그대로 넘길 수 없으므로, 클라이언트가 실제로 쓰는 필드(name/status)만 추출한다.
  const rounds = roundsSnap.docs.map((d) => {
    const data = d.data();
    return { id: d.id, name: data.name as string, status: data.status as string };
  });
  const regions = regionsSnap.docs.map((d) => ({ id: d.id, name: d.data().name as string }));
  const regionNameById = new Map(regions.map((r) => [r.id, r.name]));

  const branches: AdminBranch[] = branchDocs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      name: data.name,
      branchType: data.branchType,
      isActive: data.isActive,
      regionId: data.regionId,
      regionName: regionNameById.get(data.regionId) ?? "",
      needsTypeReview: !!data.needsTypeReview,
    };
  });

  const activeRound = rounds.find((r) => r.status === "진행중") ?? null;
  let codes: { id: string; orderNo: number; label: string; description: string | null; requiresAction: boolean }[] = [];
  let regionStatuses: RegionStatus[] = [];
  if (activeRound) {
    const codesSnap = await adminDb
      .collection("directiveCodes")
      .where("roundId", "==", activeRound.id)
      .orderBy("orderNo", "asc")
      .get();
    codes = codesSnap.docs.map((d) => {
      const data = d.data();
      return { id: d.id, orderNo: data.orderNo, label: data.label, description: data.description ?? null, requiresAction: data.requiresAction };
    });

    // 지역본부별 마감 현황 — 지점/대리점 하나하나가 제작물 전송·조치결과
    // 입력 두 프로세스 각각 마감했는지를 본사가 한눈에 볼 수 있어야 한다
    // (펼치면 전체 목록이 마감/미마감 뱃지로 보임).
    const [completedSubmissionIds, completedActionIds] = await Promise.all([
      getCompletedBranchIds(activeRound.id, null, "submission"),
      getCompletedBranchIds(activeRound.id, null, "action"),
    ]);
    regionStatuses = await Promise.all(
      regions.map(async (r) => {
        const lock = await getRegionLockStatus(activeRound.id, r.id);
        const regionBranches = branches
          .filter((b) => b.regionId === r.id)
          .map((b) => ({
            id: b.id,
            name: b.name,
            branchType: b.branchType,
            isCompleted: completedSubmissionIds.has(b.id),
            isActionCompleted: completedActionIds.has(b.id),
          }));
        return {
          id: r.id,
          name: r.name,
          isSubmitted: lock.submissionRegionClosed,
          isClosed: lock.submissionHqClosed,
          actionIsSubmitted: lock.actionRegionClosed,
          actionIsClosed: lock.actionHqClosed,
          totalBranches: regionBranches.length,
          completedBranches: regionBranches.filter((b) => b.isCompleted).length,
          actionCompletedBranches: regionBranches.filter((b) => b.isActionCompleted).length,
          branches: regionBranches,
        };
      })
    );
  }

  return (
    <AdminBoard
      rounds={rounds}
      regions={regions}
      branches={branches}
      activeRound={activeRound}
      initialCodes={codes}
      regionStatuses={regionStatuses}
    />
  );
}
