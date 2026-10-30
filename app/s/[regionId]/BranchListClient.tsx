"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { TACTILE_BUTTON } from "@/lib/tactileButton";

type Branch = { id: string; name: string; branchType: string };
export type RoundOption = { id: string; name: string; status: string };

// 지점/대리점을 선택하면 바로 들어가지 않고, 그 지점/대리점의 코드를
// 입력해야 진입할 수 있다 — 잘못된 매장으로 들어가 엉뚱한 사진을
// 올리는 실수를 막기 위함. 코드는 서버(/api/branch/{id}/verify-code)에서만
// 검증하고, 목록 응답에는 코드 값을 전혀 내려주지 않는다.
function CodeVerifyModal({
  branch,
  onCancel,
  onVerified,
}: {
  branch: Branch;
  onCancel: () => void;
  onVerified: () => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function submit() {
    const trimmed = code.trim();
    if (!trimmed) return;
    setChecking(true);
    setError(null);
    try {
      const res = await fetch(`/api/branch/${branch.id}/verify-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });
      const data = await res.json().catch(() => ({ ok: false }));
      if (res.ok && data.ok) {
        onVerified();
      } else {
        setError("코드를 다시 확인해주세요.");
      }
    } catch {
      setError("코드를 다시 확인해주세요.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-6">
      <div className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4">
        <div>
          <h2 className="text-lg font-bold">{branch.name}</h2>
          <p className="text-sm text-gray-500 mt-1">
            {branch.branchType} 코드를 입력해주세요. 코드는 대소문자 모두 가능합니다.
          </p>
        </div>
        <input
          autoFocus
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="지점/대리점 코드"
          className="w-full border rounded-xl py-3 px-4 text-base"
        />
        {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className={`${TACTILE_BUTTON} flex-1 bg-white border text-gray-700 py-3`}
          >
            취소
          </button>
          <button
            onClick={submit}
            disabled={checking || !code.trim()}
            className={`${TACTILE_BUTTON} flex-1 bg-blue-600 text-white py-3 disabled:opacity-50`}
          >
            {checking ? "확인 중..." : "확인"}
          </button>
        </div>
      </div>
    </div>
  );
}

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
  const router = useRouter();
  const [branches, setBranches] = useState<Branch[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [branchType, setBranchType] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [pendingBranch, setPendingBranch] = useState<Branch | null>(null);
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
          <button
            key={b.id}
            onClick={() => setPendingBranch(b)}
            className={`${TACTILE_BUTTON} w-full flex items-center bg-white text-gray-900 px-5 py-5`}
          >
            <span className="text-lg">{b.name}</span>
          </button>
        ))}
      </main>

      {pendingBranch && (
        <CodeVerifyModal
          branch={pendingBranch}
          onCancel={() => setPendingBranch(null)}
          onVerified={() => router.push(`/s/${regionId}/${pendingBranch.id}${roundQuery}`)}
        />
      )}
    </div>
  );
}
