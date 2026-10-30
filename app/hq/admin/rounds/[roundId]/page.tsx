import { notFound } from "next/navigation";
import { connection } from "next/server";
import Link from "next/link";
import { adminDb } from "@/lib/firebase/admin";

export const instant = false;

// 과거(마감된) 라운드의 지역본부 목록을 보여주는 진입 화면. 과거에는 이
// 페이지 자체가 전체 지역본부를 한 표에 뒤섞어 보여주는 별도의 읍기전용
// 표였는데, 색상/그룹핑이 실제 운영 화면과 달라 혼란스럽다는 피드백으로
// 폐기 — 이미 완성되어 있는 본사용(/hq/{regionId})·지역본부용(/r/{regionId})
// 화면이 roundId 쿼리파라미터로 과거 라운드를 그대로 보여줄 수 있으므로
// (2026-10-30, Part 1에서 추가), 이 페이지는 "어느 지역본부로 들어갈지"
// 고르는 목차 역할만 한다 — 들어가면 평소 쓰는 것과 완전히 동일한 UI
// (색상/필터/그룹핑)로 보인다(2026-10-30).
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

  // roundId 단독 복합 인덱스가 없으므로 전체를 가져와 메모리에서 거른다
  // (기존 프로젝트 관례와 동일한 패턴).
  const itemsSnapAll = await adminDb.collection("items").get();
  const roundItems = itemsSnapAll.docs.filter((d) => d.data().roundId === roundId);

  const branchIds = new Set(roundItems.map((d) => d.data().branchId as string));
  const branchDocs = await Promise.all(
    Array.from(branchIds).map((id) => adminDb.collection("branches").doc(id).get())
  );
  const branchById = new Map(branchDocs.filter((d) => d.exists).map((d) => [d.id, d.data()!]));

  const regionIds = new Set(Array.from(branchById.values()).map((b) => b.regionId as string));
  const regionDocs = await Promise.all(
    Array.from(regionIds).map((id) => adminDb.collection("regions").doc(id).get())
  );

  const itemCountByBranch = new Map<string, number>();
  for (const doc of roundItems) {
    const branchId = doc.data().branchId as string;
    itemCountByBranch.set(branchId, (itemCountByBranch.get(branchId) ?? 0) + 1);
  }

  const branchesByRegion = new Map<
    string,
    { id: string; name: string; branchType: string; itemCount: number }[]
  >();
  for (const [branchId, branch] of branchById) {
    const regionId = branch.regionId as string;
    const list = branchesByRegion.get(regionId) ?? [];
    list.push({
      id: branchId,
      name: branch.name as string,
      branchType: branch.branchType as string,
      itemCount: itemCountByBranch.get(branchId) ?? 0,
    });
    branchesByRegion.set(regionId, list);
  }
  const branchTypeOrder: Record<string, number> = { 지점: 0, 대리점: 1 };
  for (const list of branchesByRegion.values()) {
    list.sort((a, b) => {
      const ai = branchTypeOrder[a.branchType] ?? 2;
      const bi = branchTypeOrder[b.branchType] ?? 2;
      if (ai !== bi) return ai - bi;
      return a.name.localeCompare(b.name, "ko");
    });
  }

  const regions = regionDocs
    .filter((d) => d.exists)
    .map((d) => ({
      id: d.id,
      name: d.data()!.name as string,
      branches: branchesByRegion.get(d.id) ?? [],
      itemCount: (branchesByRegion.get(d.id) ?? []).reduce((sum, b) => sum + b.itemCount, 0),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4">
        <Link href="/hq/admin" className="text-sm text-blue-600 font-medium">
          ← 관리 설정으로
        </Link>
        <h1 className="text-lg font-bold mt-1">{round.name as string} — 지역본부별 데이터 보기</h1>
        <p className="text-sm text-gray-500">
          상태: {round.status as string} · 총 {roundItems.length}건 · 지역본부 {regions.length}곳
        </p>
      </header>

      <main className="px-6 py-4 max-w-3xl">
        {regions.length === 0 ? (
          <p className="text-center text-gray-400 py-10">이 라운드에 등록된 데이터가 없습니다.</p>
        ) : (
          <div className="space-y-4">
            {regions.map((r) => (
              <div key={r.id} className="bg-white border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold">{r.name}</p>
                    <p className="text-xs text-gray-400">{r.itemCount}건 · 지점/대리점 {r.branches.length}곳</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/r/${r.id}?roundId=${roundId}`}
                      className="text-sm border rounded px-3 py-1.5 text-blue-600 hover:bg-blue-50 whitespace-nowrap"
                    >
                      지역본부용으로 보기
                    </Link>
                    <Link
                      href={`/hq/${r.id}?roundId=${roundId}`}
                      className="text-sm border rounded px-3 py-1.5 text-blue-600 hover:bg-blue-50 whitespace-nowrap"
                    >
                      본사용으로 보기
                    </Link>
                  </div>
                </div>
                {r.branches.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1 border-t">
                    {r.branches.map((b) => (
                      <Link
                        key={b.id}
                        href={`/s/${r.id}/${b.id}?roundId=${roundId}`}
                        className="text-xs border rounded-full px-2.5 py-1 text-gray-600 hover:bg-gray-50"
                      >
                        {b.name} ({b.branchType}) · {b.itemCount}건
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
