import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/authz";
import { adminDb } from "@/lib/firebase/admin";
import { getRegionLockStatus } from "@/lib/regionLock";
import HqBoard, { type HqItem, type DirectiveCodeOption, type RegionStatus } from "./HqBoard";

export const instant = false;

export default async function HqPage() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "hq") redirect("/login");

  // 본사는 상태/지역에 조건 없이 항상 전체를 조회한다 (설계 원칙).
  const itemsSnap = await adminDb.collection("items").orderBy("createdAt", "desc").get();

  const branchIds = new Set<string>();
  const regionIds = new Set<string>();
  const codeIds = new Set<string>();
  const rawItems = itemsSnap.docs.map((d) => {
    const data = d.data();
    branchIds.add(data.branchId);
    regionIds.add(data.regionId);
    if (data.directiveCodeId) codeIds.add(data.directiveCodeId);
    return { id: d.id, ...data };
  });

  const [branchDocs, regionDocs, codeDocs] = await Promise.all([
    Promise.all(Array.from(branchIds).map((id) => adminDb.collection("branches").doc(id).get())),
    Promise.all(Array.from(regionIds).map((id) => adminDb.collection("regions").doc(id).get())),
    Promise.all(Array.from(codeIds).map((id) => adminDb.collection("directiveCodes").doc(id).get())),
  ]);
  const branchById = new Map(branchDocs.filter((d) => d.exists).map((d) => [d.id, d.data()!]));
  const regionById = new Map(regionDocs.filter((d) => d.exists).map((d) => [d.id, d.data()!]));
  const codeById = new Map(codeDocs.filter((d) => d.exists).map((d) => [d.id, d.data()!]));

  type RawItem = {
    id: string;
    itemType: string;
    note: string | null;
    status: HqItem["status"];
    photoPath: string;
    actionPhotoPath: string | null;
    regionRejectReason: string | null;
    hqRejectReason: string | null;
    branchId: string;
    regionId: string;
    directiveCodeId?: string;
  };

  const items: HqItem[] = (rawItems as RawItem[]).map((item) => ({
    id: item.id,
    itemType: item.itemType,
    note: item.note,
    status: item.status,
    photoPath: item.photoPath,
    actionPhotoPath: item.actionPhotoPath,
    regionRejectReason: item.regionRejectReason,
    hqRejectReason: item.hqRejectReason,
    branch: branchById.has(item.branchId)
      ? { name: branchById.get(item.branchId)!.name, branchType: branchById.get(item.branchId)!.branchType }
      : null,
    region: regionById.has(item.regionId)
      ? { id: item.regionId, name: regionById.get(item.regionId)!.name }
      : null,
    directiveCode: item.directiveCodeId && codeById.has(item.directiveCodeId)
      ? { id: item.directiveCodeId, label: codeById.get(item.directiveCodeId)!.label, description: codeById.get(item.directiveCodeId)!.description ?? null }
      : null,
  }));

  const activeRoundSnap = await adminDb.collection("rounds").where("status", "==", "진행중").limit(1).get();
  let activeCodes: DirectiveCodeOption[] = [];
  let regionStatuses: RegionStatus[] = [];
  if (!activeRoundSnap.empty) {
    const activeRoundId = activeRoundSnap.docs[0].id;
    const codesSnap = await adminDb
      .collection("directiveCodes")
      .where("roundId", "==", activeRoundId)
      .orderBy("orderNo", "asc")
      .get();
    activeCodes = codesSnap.docs.map((d) => {
      const data = d.data();
      return { id: d.id, label: data.label, description: data.description ?? null, requiresAction: data.requiresAction };
    });

    const allRegionsSnap = await adminDb.collection("regions").orderBy("name").get();
    regionStatuses = await Promise.all(
      allRegionsSnap.docs.map(async (d) => {
        const lock = await getRegionLockStatus(activeRoundId, d.id);
        return { id: d.id, name: d.data().name as string, ...lock };
      })
    );
  }

  return <HqBoard initialItems={items} directiveCodes={activeCodes} regionStatuses={regionStatuses} />;
}
