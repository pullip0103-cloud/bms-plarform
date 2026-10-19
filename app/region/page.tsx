import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/authz";
import { adminDb } from "@/lib/firebase/admin";
import { getRegionLockStatus } from "@/lib/regionLock";
import RegionBoard, { type RegionItem } from "./RegionBoard";

export const instant = false;

export default async function RegionPage() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "region") redirect("/login");

  const roundSnap = await adminDb
    .collection("rounds")
    .where("status", "==", "진행중")
    .limit(1)
    .get();
  const activeRound = roundSnap.empty
    ? null
    : { id: roundSnap.docs[0].id, name: roundSnap.docs[0].data().name as string };
  const lock = activeRound
    ? await getRegionLockStatus(activeRound.id, profile.regionId!)
    : { isSubmitted: false, isClosed: false };

  const itemsSnap = await adminDb
    .collection("items")
    .where("regionId", "==", profile.regionId)
    .orderBy("createdAt", "desc")
    .get();

  const branchIds = new Set<string>();
  const codeIds = new Set<string>();
  type RawItem = {
    id: string;
    itemType: string;
    note: string | null;
    status: RegionItem["status"];
    photoPath: string;
    actionPhotoPath: string | null;
    regionRejectReason: string | null;
    branchId: string;
    directiveCodeId?: string;
  };
  const rawItems = itemsSnap.docs.map((d) => {
    const data = d.data();
    branchIds.add(data.branchId);
    if (data.directiveCodeId) codeIds.add(data.directiveCodeId);
    return { id: d.id, ...data } as RawItem;
  });

  const [branchDocs, codeDocs] = await Promise.all([
    Promise.all(Array.from(branchIds).map((id) => adminDb.collection("branches").doc(id).get())),
    Promise.all(Array.from(codeIds).map((id) => adminDb.collection("directiveCodes").doc(id).get())),
  ]);
  const branchById = new Map(branchDocs.filter((d) => d.exists).map((d) => [d.id, d.data()!]));
  const codeById = new Map(codeDocs.filter((d) => d.exists).map((d) => [d.id, d.data()!]));

  const items: RegionItem[] = rawItems.map((item) => ({
    id: item.id,
    itemType: item.itemType,
    note: item.note,
    status: item.status,
    photoPath: item.photoPath,
    actionPhotoPath: item.actionPhotoPath,
    regionRejectReason: item.regionRejectReason,
    branch: branchById.has(item.branchId)
      ? { name: branchById.get(item.branchId)!.name, branchType: branchById.get(item.branchId)!.branchType }
      : null,
    directiveCode: item.directiveCodeId && codeById.has(item.directiveCodeId)
      ? { label: codeById.get(item.directiveCodeId)!.label, description: codeById.get(item.directiveCodeId)!.description ?? null }
      : null,
  }));

  return (
    <RegionBoard
      initialItems={items}
      activeRoundName={activeRound?.name ?? null}
      initialIsSubmitted={lock.isSubmitted}
      initialIsClosed={lock.isClosed}
    />
  );
}
