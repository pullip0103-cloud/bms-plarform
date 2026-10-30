import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { resolveRegion } from "@/lib/authz";
import { getRegionLockStatus } from "@/lib/regionLock";

// "새로고침" 버튼이 호출하는 데이터 전용 엔드포인트. app/hq/[regionId]/page.tsx의
// 조회 로직을 그대로 옮긴 것(지점 선택 드롭다운을 위해 branches도 함께 내려준다) —
// 새로고침 시 location.reload() 대신 이걸 fetch해서 selectedBranchId를 날리지 않는다.
// roundId 쿼리파라미터로 과거 라운드도 조회 가능하다(2026-10-30, 지점/지역본부용과
// 동일한 원칙).
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
  const selectedRoundId = selectedRound?.id ?? null;

  const itemsSnapAll = await adminDb
    .collection("items")
    .where("regionId", "==", regionId)
    .orderBy("createdAt", "desc")
    .get();
  const itemsSnap = selectedRoundId
    ? { docs: itemsSnapAll.docs.filter((d) => d.data().roundId === selectedRoundId) }
    : null;

  const branchIds = new Set<string>();
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
        branchIds.add(data.branchId);
        if (data.directiveCodeId) codeIds.add(data.directiveCodeId);
        return { id: d.id, ...data } as RawItem;
      })
    : [];

  const [branchDocs, codeDocs, activeBranchesSnap] = await Promise.all([
    Promise.all(Array.from(branchIds).map((id) => adminDb.collection("branches").doc(id).get())),
    Promise.all(Array.from(codeIds).map((id) => adminDb.collection("directiveCodes").doc(id).get())),
    adminDb
      .collection("branches")
      .where("regionId", "==", regionId)
      .where("isActive", "==", true)
      .orderBy("name")
      .get(),
  ]);
  const branchById = new Map(branchDocs.filter((d) => d.exists).map((d) => [d.id, d.data()!]));
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
      item.directiveCodeId && codeById.has(item.directiveCodeId)
        ? {
            id: item.directiveCodeId,
            label: codeById.get(item.directiveCodeId)!.label,
            description: codeById.get(item.directiveCodeId)!.description ?? null,
            requiresAction: codeById.get(item.directiveCodeId)!.requiresAction as boolean,
          }
        : null,
    directiveComment: item.directiveComment ?? null,
  }));

  const branches = activeBranchesSnap.docs.map((d) => ({
    id: d.id,
    name: d.data().name as string,
    branchType: d.data().branchType as string,
  }));

  let activeCodes: { id: string; label: string; description: string | null; requiresAction: boolean }[] = [];
  let lock = {
    submissionRegionClosed: false,
    actionRegionClosed: false,
    submissionHqClosed: false,
    actionHqClosed: false,
    directivePublished: false,
  };
  if (selectedRoundId) {
    const codesSnap = await adminDb
      .collection("directiveCodes")
      .where("roundId", "==", selectedRoundId)
      .orderBy("orderNo", "asc")
      .get();
    activeCodes = codesSnap.docs.map((d) => {
      const data = d.data();
      return { id: d.id, label: data.label, description: data.description ?? null, requiresAction: data.requiresAction };
    });
    const fullLock = await getRegionLockStatus(selectedRoundId, regionId);
    lock = {
      submissionRegionClosed: fullLock.submissionRegionClosed,
      actionRegionClosed: fullLock.actionRegionClosed,
      submissionHqClosed: fullLock.submissionHqClosed,
      actionHqClosed: fullLock.actionHqClosed,
      directivePublished: fullLock.directivePublished,
    };
  }

  return NextResponse.json({ items, branches, directiveCodes: activeCodes, lock });
}
