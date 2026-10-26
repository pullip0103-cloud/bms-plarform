"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TACTILE_BUTTON } from "@/lib/tactileButton";

type Branch = { id: string; name: string; branchType: string };
export type RoundOption = { id: string; name: string; status: string };

function RoundSelect({
  rounds,
  selectedRoundId,
  regionId,
}: {
  rounds: RoundOption[];
  selectedRoundId: string | null;
  regionId: string;
}) {
  const router = useRouter();
  return (
    <select
      value={selectedRoundId ?? ""}
      onChange={(e) => {
        const params = new URLSearchParams();
        if (e.target.value) params.set("roundId", e.target.value);
        router.push(`/s/${regionId}${params.toString() ? `?${params.toString()}` : ""}`);
      }}
      className="text-sm border rounded px-2 py-1.5"
    >
      {rounds.map((r) => (
        <option key={r.id} value={r.id}>
          {r.name} {r.status !== "진행중" ? "(마감)" : ""}
        </option>
      ))}
    </select>
  );
}

export default function BranchListClient({
  regionId,
  regionName,
  rounds,
  selectedRoundId,
}: {
  regionId: string;
  regionName: string;
  rounds: RoundOption[];
  selectedRoundId: string | null;
}) {
  const [branches, setBranches] = useState<Branch[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [branchType, setBranchType] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const roundQuery = selectedRoundId ? `?roundId=${selectedRoundId}` : "";

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

  const branchCount = branches?.filter((b) => b.branchType === "지점").length ?? 0;
  const agencyCount = branches?.filter((b) => b.branchType === "대리점").length ?? 0;

  // 1단계: 지점/대리점 유형부터 선택
  if (!branchType) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <header className="px-6 pt-10 pb-6 text-center space-y-2">
          <p className="text-base text-gray-500">전국 BMS 전수조사</p>
          <h1 className="text-3xl font-bold text-gray-900">{regionName}</h1>
          <div className="flex justify-center">
            <RoundSelect rounds={rounds} selectedRoundId={selectedRoundId} regionId={regionId} />
          </div>
        </header>

        <main className="flex-1 px-6 py-4 space-y-4">
          {error && <p className="text-center text-red-600 py-10">{error}</p>}
          {!error && !branches && (
            <p className="text-center text-gray-400 py-10">불러오는 중...</p>
          )}
          {branches && (
            <>
              <p className="text-center text-xl font-semibold text-gray-700 mb-2">
                소속 지점/대리점을 선택해주세요
              </p>
              <button
                onClick={() => setBranchType("지점")}
                className={`${TACTILE_BUTTON} w-full bg-blue-600 text-white py-8 text-2xl`}
              >
                지점
                <span className="block text-sm font-normal opacity-80 mt-1">
                  {branchCount}개
                </span>
              </button>
              <button
                onClick={() => setBranchType("대리점")}
                className={`${TACTILE_BUTTON} w-full bg-emerald-600 text-white py-8 text-2xl`}
              >
                대리점
                <span className="block text-sm font-normal opacity-80 mt-1">
                  {agencyCount}개
                </span>
              </button>
            </>
          )}
        </main>
      </div>
    );
  }

  // 2단계: 선택한 유형 안에서 세부 지점/대리점 선택
  const filtered = branches
    ?.filter((b) => b.branchType === branchType)
    .filter((b) => b.name.includes(query.trim()));

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-4 py-4 sticky top-0 z-10 space-y-3">
        <button
          onClick={() => setBranchType(null)}
          className="text-sm text-blue-600 font-medium"
        >
          ← {branchType} / 대리점 다시 선택
        </button>
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm text-gray-500">{regionName}</p>
            <h1 className="text-xl font-bold">내 {branchType} 선택</h1>
          </div>
          <RoundSelect rounds={rounds} selectedRoundId={selectedRoundId} regionId={regionId} />
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`${branchType}명 검색`}
          className="w-full border rounded-xl py-3 px-4 text-base"
        />
      </header>

      <main className="px-4 py-4 space-y-3">
        {filtered?.length === 0 && (
          <p className="text-center text-gray-400 py-10">검색 결과가 없습니다.</p>
        )}
        {filtered?.map((b) => (
          <Link
            key={b.id}
            href={`/s/${regionId}/${b.id}${roundQuery}`}
            className={`${TACTILE_BUTTON} flex items-center bg-white text-gray-900 px-5 py-5`}
          >
            <span className="text-lg">{b.name}</span>
          </Link>
        ))}
      </main>
    </div>
  );
}
