"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Branch = { id: string; name: string; branchType: string };

export default function BranchListClient({ regionId }: { regionId: string }) {
  const [branches, setBranches] = useState<Branch[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/branch/regions/${regionId}/branches`);
      if (!res.ok) {
        setError("지점/대리점 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
        return;
      }
      const data = await res.json();
      setBranches(data.branches);
    })();
  }, [regionId]);

  const filtered = branches?.filter((b) => b.name.includes(query.trim()));

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-4 py-4 sticky top-0 z-10 space-y-2">
        <div>
          <Link href="/s" className="text-sm text-blue-600">
            ← 지역본부 다시 선택
          </Link>
        </div>
        <h1 className="text-lg font-bold">내 지점/대리점 선택</h1>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="지점/대리점명 검색"
          className="w-full border rounded-lg py-2 px-3 text-base"
        />
      </header>

      <main className="px-4 py-4 space-y-2">
        {error && <p className="text-center text-red-600 py-10">{error}</p>}
        {!error && !branches && <p className="text-center text-gray-400 py-10">불러오는 중...</p>}
        {filtered?.length === 0 && (
          <p className="text-center text-gray-400 py-10">검색 결과가 없습니다.</p>
        )}
        {filtered?.map((b) => (
          <Link
            key={b.id}
            href={`/s/${regionId}/${b.id}`}
            className="flex justify-between items-center bg-white border rounded-lg px-4 py-4"
          >
            <span className="text-base font-medium">{b.name}</span>
            <span className="text-sm text-gray-400">{b.branchType}</span>
          </Link>
        ))}
      </main>
    </div>
  );
}
