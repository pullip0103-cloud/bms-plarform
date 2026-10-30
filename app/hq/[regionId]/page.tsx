import { notFound } from "next/navigation";
import { connection } from "next/server";
import { resolveRegion } from "@/lib/authz";
import { adminDb } from "@/lib/firebase/admin";
import { getRegionLockStatus } from "@/lib/regionLock";
import HqRegionBoard, {
  type HqItem,
  type DirectiveCodeOption,
  type HqBranch,
  type RoundOption,
} from "./HqRegionBoard";

export const instant = false;

export default async function HqRegionPage({
  params,
  searchParams,
}: {
  params: Promise<{ regionId: string }>;
  searchParams: Promise<{ roundId?: string }>;
}) {
  await connection();
  const { regionId } = await params;
  const { roundId: requestedRoundId } = await searchParams;
  const region = await resolveRegion(regionId);
  if (!region) notFound();

  // 지역본부용(/r)과 동일하게, roundId가 지정되면 그 라운드를 조회하고
  // (과거 라운드 포함) 지정되지 않으면 "진행중" 라운드를 기본으로 본다.
  // 과거에는 본사용 화면이 항상 "진행중" 라운드만 봤는데, 과거 라운드도
  // 지점/지역본부용처럼 조회 가능해야 한다는 요구사항으로 추가(2026-10-30).
  const roundsSnap = await adminDb.collection("rounds").orderBy("createdAt", "desc").get();
  const rounds: RoundOption[] = roundsSnap.docs.map((d) => ({
    id: d.id,
    name: d.data().name as string,
    status: d.data().status as string,
  }));

  const selectedRound =
    (requestedRoundId && rounds.find((r) => r.id === requestedRoundId)) ||
    rounds.find((r) => r.status === "진행중") ||
    null;
  const isPastRound = selectedRound ? selectedRound.status !== "진행중" : false;
  const selectedRoundId = selectedRound?.id ?? null;

  // regionId만으로 조회한 뒤 roundId는 메모리에서 거른다 — regionId+roundId
  // 복합 인덱스가 없어도 되게끔(Firestore 콘솔에서 인덱스를 새로 만들
  // 필요가 없음). 지역본부당 항목 수가 수백~수천 건 수준이라 괜찮다.
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
    directiveComment: item.directiveComment ?? null,
  }));

  let activeCodes: DirectiveCodeOption[] = [];
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

  return (
    <HqRegionBoard
      regionId={regionId}
      regionName={region.name}
      initialItems={items}
      branches={branches}
      directiveCodes={activeCodes}
      initialLock={lock}
      rounds={rounds}
      selectedRoundId={selectedRoundId}
      isPastRound={isPastRound}
    />
  );
}
