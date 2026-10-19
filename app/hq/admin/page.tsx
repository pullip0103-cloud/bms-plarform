import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/authz";
import { adminDb } from "@/lib/firebase/admin";
import AdminBoard, { type AdminBranch } from "./AdminBoard";

export const instant = false;

export default async function AdminPage() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "hq") redirect("/login");

  const [roundsSnap, regionsSnap, branchesSnap] = await Promise.all([
    adminDb.collection("rounds").orderBy("createdAt", "desc").get(),
    adminDb.collection("regions").orderBy("name").get(),
    adminDb.collection("branches").orderBy("name").get(),
  ]);

  // Firestore Timestamp(createdAt 등)는 클래스 인스턴스라 서버->클라이언트 컴포넌트로
  // 그대로 넘길 수 없으므로, 클라이언트가 실제로 쓰는 필드(name/status)만 추출한다.
  const rounds = roundsSnap.docs.map((d) => {
    const data = d.data();
    return { id: d.id, name: data.name as string, status: data.status as string };
  });
  const regions = regionsSnap.docs.map((d) => ({ id: d.id, name: d.data().name as string }));
  const regionNameById = new Map(regions.map((r) => [r.id, r.name]));

  const branches: AdminBranch[] = branchesSnap.docs.map((d) => {
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
  }

  return (
    <AdminBoard
      rounds={rounds}
      regions={regions}
      branches={branches}
      activeRound={activeRound}
      initialCodes={codes}
    />
  );
}
