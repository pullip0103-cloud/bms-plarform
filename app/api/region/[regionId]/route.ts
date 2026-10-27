import { NextRequest, NextResponse } from "next/server";
import { resolveRegion } from "@/lib/authz";
import { adminDb } from "@/lib/firebase/admin";
import { getRegionLockStatus } from "@/lib/regionLock";
import { getCompletedBranchIds } from "@/lib/branchLock";

// "새로고침" 버튼이 호출하는 데이터 전용 엔드포인트. app/r/[regionId]/page.tsx의
// 조회 로직을 그대로 옮긴 것 — 새로고침 시 location.reload() 대신 이걸 fetch해서
// 클라이언트 state(selectedBranchId/branchTypeFilter)를 날리지 않고 데이터만 교체한다.
export async function GET(req: NextRequest, { params }: { params: Promise<{ regionId: string }> }) {
  const { regionId } = await params;
  const requestedRoundId = req.nextUrl.searchParams.get("roundId") ?? undefined;
  const region = await resolveRegion(regionId);
  if (!region) {
    return NextResponse.json({ error: "INVALID_REGION" }, { status: 404 });
  }

  const roundsSnap = await adminDb.collection("rounds").orderBy("createdAt", "desc").get();
  const rounds = roundsSnap.docs.map((d) => ({
    id: d.id,
    name: d.data().name as string,
    status: d.data().status as string,
  }));

  const selectedRound =
    (requestedRoundId && rounds.find((r) => r.id === requestedRoundId)) ||
    rounds.find((r) => r.status === "진행중") ||
    null;
  const isPastRound = selectedRound ? selectedRound.status !== "진행중" : false;

  const lock = selectedRound
    ? await getRegionLockStatus(selectedRound.id, regionId)
    : {
        submissionRegionClosed: false,
        actionRegionClosed: false,
        submissionHqClosed: false,
        actionHqClosed: false,
        directivePublished: false,
      };
  const completedSubmissionIds = selectedRound
    ? await getCompletedBranchIds(selectedRound.id, regionId, "submission")
    : new Set<string>();
  const completedActionIds = selectedRound
    ? await getCompletedBranchIds(selectedRound.id, regionId, "action")
    : new Set<string>();

  const [itemsSnapAll, branchesSnap] = await Promise.all([
    adminDb.collection("items").where("regionId", "==", regionId).orderBy("createdAt", "desc").get(),
    adminDb
      .collection("branches")
      .where("regionId", "==", regionId)
      .where("isActive", "==", true)
      .orderBy("name")
      .get(),
  ]);
  const itemsSnap = selectedRound
    ? { docs: itemsSnapAll.docs.filter((d) => d.data().roundId === selectedRound.id) }
    : null;

  const branches = branchesSnap.docs.map((d) => ({
    id: d.id,
    name: d.data().name as string,
    branchType: d.data().branchType as string,
    submissionCompleted: completedSubmissionIds.has(d.id),
    actionCompleted: completedActionIds.has(d.id),
  }));
  const branchById = new Map(branchesSnap.docs.map((d) => [d.id, d.data()!]));

  const codeIds = new Set<string>();
  type RawItem = {
    id: string;
    note: string | null;
    photoPath: string;
    actionPhotoPath: string | null;
    actionNote: string | null;
    branchId: string;
    directiveCodeId?: string;
    directiveComment?: string | null;
  };
  const rawItems = itemsSnap
    ? itemsSnap.docs.map((d) => {
        const data = d.data();
        if ((lock.directivePublished || isPastRound) && data.directiveCodeId) codeIds.add(data.directiveCodeId);
        return { id: d.id, ...data } as RawItem;
      })
    : [];

  const codeDocs = await Promise.all(
    Array.from(codeIds).map((id) => adminDb.collection("directiveCodes").doc(id).get())
  );
  const codeById = new Map(codeDocs.filter((d) => d.exists).map((d) => [d.id, d.data()!]));

  const items = rawItems.map((item) => ({
    id: item.id,
    note: item.note,
    photoPath: item.photoPath,
    actionPhotoPath: item.actionPhotoPath,
    actionNote: item.actionNote ?? null,
    branchId: item.branchId,
    branch: branchById.has(item.branchId)
      ? { name: branchById.get(item.branchId)!.name as string, branchType: branchById.get(item.branchId)!.branchType as string }
      : null,
    directiveCode:
      (lock.directivePublished || isPastRound) && item.directiveCodeId && codeById.has(item.directiveCodeId)
        ? {
            label: codeById.get(item.directiveCodeId)!.label,
            description: codeById.get(item.directiveCodeId)!.description ?? null,
            requiresAction: codeById.get(item.directiveCodeId)!.requiresAction as boolean,
          }
        : null,
    directiveComment: (lock.directivePublished || isPastRound) ? item.directiveComment ?? null : null,
  }));

  return NextResponse.json({
    items,
    branches,
    activeRoundName: selectedRound?.name ?? null,
    lock,
    rounds,
    selectedRoundId: selectedRound?.id ?? null,
    isPastRound,
  });
}
