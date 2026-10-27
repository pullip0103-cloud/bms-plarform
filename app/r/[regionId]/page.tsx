import { notFound } from "next/navigation";
import { connection } from "next/server";
import { resolveRegion } from "@/lib/authz";
import { adminDb } from "@/lib/firebase/admin";
import { getRegionLockStatus } from "@/lib/regionLock";
import { getCompletedBranchIds } from "@/lib/branchLock";
import RegionBoard, { type RegionItem, type RegionBranch, type RoundOption } from "./RegionBoard";

export const instant = false;

export default async function RegionPage({
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

  const roundsSnap = await adminDb.collection("rounds").orderBy("createdAt", "desc").get();
  const rounds: RoundOption[] = roundsSnap.docs.map((d) => ({
    id: d.id,
    name: d.data().name as string,
    status: d.data().status as string,
  }));

  // roundId가 지정되지 않으면 "진행중" 라운드를 기본으로 본다. 지정된
  // roundId가 실제로 존재하지 않으면(잘못된 링크 등) 역시 진행중 라운드로
  // 되돌아간다.
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

  // regionId만으로 조회한 뒤 roundId는 메모리에서 거른다 — regionId+roundId
  // 복합 인덱스가 없어도 되게끔(Firestore 콘솔에서 인덱스를 새로 만들
  // 필요가 없음). 지역본부당 항목 수가 수백~수천 건 수준이라 괜찮다.
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

  const branches: RegionBranch[] = branchesSnap.docs.map((d) => ({
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

  const items: RegionItem[] = rawItems.map((item) => ({
    id: item.id,
    note: item.note,
    photoPath: item.photoPath,
    actionPhotoPath: item.actionPhotoPath,
    actionNote: item.actionNote ?? null,
    branchId: item.branchId,
    branch: branchById.has(item.branchId)
      ? { name: branchById.get(item.branchId)!.name as string, branchType: branchById.get(item.branchId)!.branchType as string }
      : null,
    directiveCode: (lock.directivePublished || isPastRound) && item.directiveCodeId && codeById.has(item.directiveCodeId)
      ? {
          label: codeById.get(item.directiveCodeId)!.label,
          description: codeById.get(item.directiveCodeId)!.description ?? null,
          requiresAction: codeById.get(item.directiveCodeId)!.requiresAction as boolean,
        }
      : null,
    directiveComment: (lock.directivePublished || isPastRound) ? item.directiveComment ?? null : null,
  }));

  return (
    <RegionBoard
      regionId={regionId}
      regionName={region.name}
      initialItems={items}
      branches={branches}
      activeRoundName={selectedRound?.name ?? null}
      initialLock={lock}
      rounds={rounds}
      selectedRoundId={selectedRound?.id ?? null}
      isPastRound={isPastRound}
    />
  );
}
