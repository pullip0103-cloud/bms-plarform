"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Region = { id: string; name: string };

export default function RegionListPage() {
  const [regions, setRegions] = useState<Region[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/branch/regions");
      if (!res.ok) {
        setError("지역본부 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
        return;
      }
      const data = await res.json();
      setRegions(data.regions);
    })();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-4 py-4 sticky top-0 z-10">
        <h1 className="text-lg font-bold">판매거점별 제작물 점검</h1>
        <p className="text-sm text-gray-500">소속 지역본부를 선택해주세요</p>
      </header>

      <main className="px-4 py-4 space-y-2">
        {error && <p className="text-center text-red-600 py-10">{error}</p>}
        {!error && !regions && <p className="text-center text-gray-400 py-10">불러오는 중...</p>}
        {regions?.map((r) => (
          <Link
            key={r.id}
            href={`/s/${r.id}`}
            className="block bg-white border rounded-lg px-4 py-4 text-base font-medium"
          >
            {r.name}
          </Link>
        ))}
      </main>
    </div>
  );
}
