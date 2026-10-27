import { notFound } from "next/navigation";
import { connection } from "next/server";
import { resolveRegion } from "@/lib/authz";
import { adminDb } from "@/lib/firebase/admin";
import { getRegionLockStatus } from "@/lib/regionLock";
import HqRegionBoard, { type HqItem, type DirectiveCodeOption, type HqBranch } from "./HqRegionBoard";

export const instant = false;

export default async function HqRegionPage({
  params,
}: {
  params: Promise<{ regionId: string }>;
}) {
  await connection();
  const { regionId } = await params;
  const region = await resolveRegion(regionId);
  if (!region) notFound();

  // 본사 화면은 항상 "현재 진행중 라운드"만 본다 — 과거 라운드 항목이 이
  // 화면에 영구히 섞여 보이지 않도록 roundId로도 필터링한다(과거 전체는
  // /hq/admin/rounds/[roundId]에서 조회).
  const activeRoundSnap = await adminDb.collection("rounds").where("status", "==", "진행중").limit(1).get();
  const activeRoundId = activeRoundSnap.empty ? null : activeRoundSnap.docs[0].id;

  // regionId만으로 조회한 뒤 roundId는 메모리에서 거른다 — regionId+roundId
  // 복합 인덱스가 없어도 되게끔(Firestore 콘솔에서 인덱스를 새로 만들
  // 필요가 없음). 지역본부당 항목 수가 수백~수천 건 수준이라 괜찮다.
  const itemsSnapAll = await adminDb
    .collection("items")
    .where("regionId", "==", regionId)
    .orderBy("createdAt", "desc")
    .get();
  const itemsSnap = activeRoundId
    ? { docs: itemsSnapAll.docs.filter((d) => d.data().roundId === activeRoundId) }
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
  const branches: HqBranch[] = activeBranchesSnap.docs.map((d) => ({
    id: d.id,
    name: d.data().name as string,
    branchType: d.data().branchType as string,
  }));

  const items: HqItem[] = rawItems.map((item) => ({
    id: item.id,
    note: item.note,
    photoPath: item.photoPath,
    actionPhotoPath: item.actionPhotoPath,
    actionNote: item.actionNote ?? null,
    branchId: item.branchId,
    branch: branchById.has(item.branchId)
      ? { name: branchById.get(item.branchId)!.name as string, branchType: branchById.get(item.branchId)!.branchType as string }
      : null,
    directiveCode: item.directiveCodeId && codeById.has(item.directiveCodeId)
      ? {
          id: item.directiveCodeId,
          label: codeById.get(item.directiveCodeId)!.label,
          description: codeById.get(item.directiveCodeId)!.description ?? null,
          requiresAction: codeById.get(item.directiveCodeId)!.requiresAction as boolean,
        }
      : null,
  }));

  let activeCodes: DirectiveCodeOption[] = [];
  let lock = {
    submissionRegionClosed: false,
    actionRegionClosed: false,
    submissionHqClosed: false,
    actionHqClosed: false,
    directivePublished: false,
  };
  if (activeRoundId) {
    const codesSnap = await adminDb
      .collection("directiveCodes")
      .where("roundId", "==", activeRoundId)
      .orderBy("orderNo", "asc")
      .get();
    activeCodes = codesSnap.docs.map((d) => {
      const data = d.data();
      return { id: d.id, label: data.label, description: data.description ?? null, requiresAction: data.requiresAction };
    });
    const fullLock = await getRegionLockStatus(activeRoundId, regionId);
    lock = {
      submissionRegionClosed: fullLock.submissionRegionClosed,
      actionRegionClosed: fullLock.actionRegionClosed,
      submissionHqClosed: fullLock.submissionHqClosed,
      actionHqClosed: fullLock.actionHqClosed,
      directivePublished: fullLock.directivePublished,
    };
  }

  return (
    <HqRegionBoard
      regionId={regionId}
      regionName={region.name}
      initialItems={items}
      branches={branches}
      directiveCodes={activeCodes}
      initialLock={lock}
    />
  );
}
