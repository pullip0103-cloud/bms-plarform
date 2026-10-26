import { notFound } from "next/navigation";
import { connection } from "next/server";
import Link from "next/link";
import { adminDb } from "@/lib/firebase/admin";
import PhotoLightbox from "@/app/components/PhotoLightbox";

export const instant = false;

// 과거(마감된) 라운드의 전체 데이터를 읽기전용으로 보여준다. 현재 라운드
// 화면(HqRegionBoard 등)과 달리 수정 기능이 전혀 없는 단순 표 — 과거 라운드는
// 더 이상 쓰기 작업이 일어나지 않으므로 상호작용 없는 조회 전용으로 충분하다.
export default async function RoundArchivePage({
  params,
}: {
  params: Promise<{ roundId: string }>;
}) {
  await connection();
  const { roundId } = await params;

  const roundSnap = await adminDb.collection("rounds").doc(roundId).get();
  if (!roundSnap.exists) notFound();
  const round = roundSnap.data()!;

  const itemsSnap = await adminDb
    .collection("items")
    .where("roundId", "==", roundId)
    .orderBy("createdAt", "desc")
    .get();

  const branchIds = new Set<string>();
  const codeIds = new Set<string>();
  const rawItems = itemsSnap.docs.map((d) => {
    const data = d.data();
    branchIds.add(data.branchId);
    if (data.directiveCodeId) codeIds.add(data.directiveCodeId);
    return { id: d.id, ...data } as Record<string, unknown> & {
      id: string;
      branchId: string;
      regionId: string;
      note: string | null;
      photoPath: string;
      actionPhotoPath: string | null;
      actionNote: string | null;
      directiveCodeId?: string;
    };
  });

  const [branchDocs, codeDocs] = await Promise.all([
    Promise.all(Array.from(branchIds).map((id) => adminDb.collection("branches").doc(id).get())),
    Promise.all(Array.from(codeIds).map((id) => adminDb.collection("directiveCodes").doc(id).get())),
  ]);
  const branchById = new Map(branchDocs.filter((d) => d.exists).map((d) => [d.id, d.data()!]));
  const codeById = new Map(codeDocs.filter((d) => d.exists).map((d) => [d.id, d.data()!]));

  const regionIds = new Set(
    Array.from(branchById.values()).map((b) => b.regionId as string)
  );
  const regionDocs = await Promise.all(
    Array.from(regionIds).map((id) => adminDb.collection("regions").doc(id).get())
  );
  const regionById = new Map(regionDocs.filter((d) => d.exists).map((d) => [d.id, d.data()!]));

  const items = rawItems
    .map((item) => {
      const branch = branchById.get(item.branchId);
      const region = branch ? regionById.get(branch.regionId as string) : undefined;
      const code = item.directiveCodeId ? codeById.get(item.directiveCodeId) : null;
      return {
        id: item.id,
        regionName: (region?.name as string) ?? "-",
        branchName: (branch?.name as string) ?? "-",
        branchType: (branch?.branchType as string) ?? "",
        note: item.note,
        photoPath: item.photoPath,
        actionPhotoPath: item.actionPhotoPath,
        actionNote: item.actionNote ?? null,
        directiveLabel: code?.label ?? null,
      };
    })
    .sort((a, b) => a.regionName.localeCompare(b.regionName, "ko") || a.branchName.localeCompare(b.branchName, "ko"));

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4">
        <Link href="/hq/admin" className="text-sm text-blue-600 font-medium">
          ← 관리 설정으로
        </Link>
        <h1 className="text-lg font-bold mt-1">{round.name as string} — 데이터 보기 (읽기전용)</h1>
        <p className="text-sm text-gray-500">상태: {round.status as string} · 총 {items.length}건</p>
      </header>

      <main className="px-6 py-4">
        <div className="bg-white border rounded-lg overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-3 py-2 font-medium whitespace-nowrap">지역본부</th>
                <th className="text-left px-3 py-2 font-medium whitespace-nowrap">거점명</th>
                <th className="text-left px-3 py-2 font-medium">제작물 사진</th>
                <th className="text-left px-3 py-2 font-medium">비고</th>
                <th className="text-left px-3 py-2 font-medium whitespace-nowrap">처리 지침</th>
                <th className="text-left px-3 py-2 font-medium">처리 결과</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-gray-400 py-10">
                    표시할 항목이 없습니다.
                  </td>
                </tr>
              )}
              {items.map((item) => (
                <tr key={item.id} className="border-b align-top">
                  <td className="px-3 py-3 whitespace-nowrap">{item.regionName}</td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {item.branchName}
                    <span className="text-gray-400"> ({item.branchType})</span>
                  </td>
                  <td className="px-3 py-3">
                    <PhotoLightbox path={item.photoPath} size="sm" />
                  </td>
                  <td className="px-3 py-3 text-gray-600">{item.note ?? "-"}</td>
                  <td className="px-3 py-3">{item.directiveLabel ?? <span className="text-gray-300">-</span>}</td>
                  <td className="px-3 py-3">
                    {item.actionPhotoPath ? (
                      <>
                        <PhotoLightbox path={item.actionPhotoPath} size="sm" />
                        {item.actionNote && <p className="text-sm text-gray-600 mt-1">{item.actionNote}</p>}
                      </>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
