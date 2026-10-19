"use client";

import { useMemo, useState } from "react";

type Round = { id: string; name: string; status: string };
type Region = { id: string; name: string };
export type AdminBranch = {
  id: string;
  name: string;
  branchType: string;
  isActive: boolean;
  regionId: string;
  regionName: string;
  needsTypeReview: boolean;
};
type Branch = AdminBranch;
type Code = {
  id: string;
  orderNo: number;
  label: string;
  description: string | null;
  requiresAction: boolean;
};

export default function AdminBoard({
  rounds,
  regions,
  branches,
  activeRound,
  initialCodes,
}: {
  rounds: Round[];
  regions: Region[];
  branches: Branch[];
  activeRound: Round | null;
  initialCodes: Code[];
}) {
  const [codes, setCodes] = useState(initialCodes);
  const [newRoundName, setNewRoundName] = useState("");
  const [newCodeLabel, setNewCodeLabel] = useState("");
  const [newCodeDesc, setNewCodeDesc] = useState("");
  const [newCodeRequiresAction, setNewCodeRequiresAction] = useState(true);
  const [newBranchName, setNewBranchName] = useState("");
  const [newBranchRegion, setNewBranchRegion] = useState(regions[0]?.id ?? "");
  const [branchList, setBranchList] = useState(branches);
  const [showOnlyReview, setShowOnlyReview] = useState(false);

  const reviewCount = branchList.filter((b) => b.needsTypeReview).length;
  const visibleBranches = useMemo(
    () => (showOnlyReview ? branchList.filter((b) => b.needsTypeReview) : branchList),
    [branchList, showOnlyReview]
  );

  async function createRound() {
    if (!newRoundName.trim()) return;
    const res = await fetch("/api/hq/rounds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newRoundName.trim() }),
    });
    if (!res.ok) {
      alert("라운드 생성에 실패했습니다.");
      return;
    }
    alert("새 라운드가 시작되었습니다. 페이지를 새로고침해주세요.");
    location.reload();
  }

  async function addCode() {
    if (!activeRound || !newCodeLabel.trim()) return;
    const res = await fetch("/api/hq/directive-codes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roundId: activeRound.id,
        label: newCodeLabel.trim(),
        description: newCodeDesc.trim(),
        requiresAction: newCodeRequiresAction,
        orderNo: codes.length + 1,
      }),
    });
    if (!res.ok) {
      alert("코드 추가에 실패했습니다.");
      return;
    }
    const { code } = await res.json();
    setCodes((prev) => [...prev, code]);
    setNewCodeLabel("");
    setNewCodeDesc("");
  }

  async function deleteCode(id: string) {
    if (!confirm("이 처리지침 코드를 삭제할까요?")) return;
    const res = await fetch(`/api/hq/directive-codes/${id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("삭제에 실패했습니다.");
      return;
    }
    setCodes((prev) => prev.filter((c) => c.id !== id));
  }

  async function addBranch() {
    if (!newBranchName.trim() || !newBranchRegion) return;
    const res = await fetch("/api/hq/branches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newBranchName.trim(), regionId: newBranchRegion }),
    });
    if (!res.ok) {
      alert("지점 등록에 실패했습니다.");
      return;
    }
    const { branch } = await res.json();
    const region = regions.find((r) => r.id === newBranchRegion);
    setBranchList((prev) => [
      ...prev,
      {
        id: branch.id,
        name: branch.name,
        branchType: branch.branchType,
        isActive: true,
        regionId: newBranchRegion,
        regionName: region?.name ?? "",
        needsTypeReview: false,
      },
    ]);
    setNewBranchName("");
  }

  async function setBranchType(id: string, branchType: "지점" | "대리점") {
    const res = await fetch(`/api/hq/branches/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ branchType }),
    });
    if (!res.ok) {
      alert("수정에 실패했습니다.");
      return;
    }
    setBranchList((prev) =>
      prev.map((b) => (b.id === id ? { ...b, branchType, needsTypeReview: false } : b))
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4">
        <h1 className="text-lg font-bold">본사 관리 설정</h1>
        <p className="text-sm text-gray-500">반기 라운드 · 처리지침 코드 · 지점 관리</p>
      </header>

      <main className="px-6 py-4 space-y-8 max-w-5xl">
        {/* 지역본부별 공유 링크 */}
        <RegionLinksSection regions={regions} />

        {/* 라운드 */}
        <section className="bg-white border rounded-lg p-4 space-y-3">
          <h2 className="font-bold">반기 라운드</h2>
          <p className="text-sm text-gray-500">
            현재 진행중: {activeRound ? activeRound.name : "없음"}
          </p>
          <div className="flex gap-2">
            <input
              value={newRoundName}
              onChange={(e) => setNewRoundName(e.target.value)}
              placeholder="예: 2026년 하반기"
              className="border rounded px-3 py-2 flex-1"
            />
            <button onClick={createRound} className="bg-blue-600 text-white rounded px-4 py-2">
              새 라운드 시작
            </button>
          </div>
          <p className="text-xs text-gray-400">
            새 라운드를 시작하면 이전 라운드는 자동으로 마감되고, 공유 링크(/s)는 새 라운드 기준으로 동작합니다.
          </p>
          <ul className="text-sm text-gray-500 space-y-1">
            {rounds.map((r) => (
              <li key={r.id}>
                {r.name} — {r.status}
              </li>
            ))}
          </ul>
        </section>

        {/* 처리지침 코드 */}
        <section className="bg-white border rounded-lg p-4 space-y-3">
          <h2 className="font-bold">처리지침 코드 (현재 라운드)</h2>
          {!activeRound && <p className="text-sm text-gray-400">진행중인 라운드가 없습니다.</p>}
          {activeRound && (
            <>
              <ul className="space-y-2">
                {codes.map((c) => (
                  <li key={c.id} className="flex justify-between items-center border rounded px-3 py-2">
                    <div>
                      <span className="font-medium">{c.label}</span>
                      {c.description && (
                        <span className="text-sm text-gray-500 ml-2">{c.description}</span>
                      )}
                      {!c.requiresAction && (
                        <span className="text-xs text-green-600 ml-2">(조치 불필요)</span>
                      )}
                    </div>
                    <button onClick={() => deleteCode(c.id)} className="text-sm text-red-600">
                      삭제
                    </button>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2 flex-wrap items-center">
                <input
                  value={newCodeLabel}
                  onChange={(e) => setNewCodeLabel(e.target.value)}
                  placeholder="코드명 (예: 철거)"
                  className="border rounded px-3 py-2"
                />
                <input
                  value={newCodeDesc}
                  onChange={(e) => setNewCodeDesc(e.target.value)}
                  placeholder="설명 (선택)"
                  className="border rounded px-3 py-2 flex-1"
                />
                <label className="text-sm flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={newCodeRequiresAction}
                    onChange={(e) => setNewCodeRequiresAction(e.target.checked)}
                  />
                  조치 필요
                </label>
                <button onClick={addCode} className="bg-blue-600 text-white rounded px-4 py-2">
                  추가
                </button>
              </div>
            </>
          )}
        </section>

        {/* 지점 관리 */}
        <section className="bg-white border rounded-lg p-4 space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="font-bold">지점/대리점 관리 ({branchList.length}개)</h2>
            {reviewCount > 0 && (
              <button
                onClick={() => setShowOnlyReview((v) => !v)}
                className={`text-sm px-3 py-1 rounded-full border ${
                  showOnlyReview ? "bg-orange-600 text-white" : "bg-orange-50 text-orange-700"
                }`}
              >
                구분 확인 필요 {reviewCount}건
              </button>
            )}
          </div>

          <div className="flex gap-2 flex-wrap">
            <input
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              placeholder="지점명"
              className="border rounded px-3 py-2"
            />
            <select
              value={newBranchRegion}
              onChange={(e) => setNewBranchRegion(e.target.value)}
              className="border rounded px-3 py-2"
            >
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <button onClick={addBranch} className="bg-blue-600 text-white rounded px-4 py-2">
              지점 추가
            </button>
          </div>

          <div className="max-h-[32rem] overflow-y-auto border rounded">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2">지역본부</th>
                  <th className="text-left px-3 py-2">지점명</th>
                  <th className="text-left px-3 py-2">구분</th>
                </tr>
              </thead>
              <tbody>
                {visibleBranches.map((b) => (
                  <tr key={b.id} className="border-t">
                    <td className="px-3 py-2">{b.regionName}</td>
                    <td className="px-3 py-2">{b.name}</td>
                    <td className="px-3 py-2">
                      {b.needsTypeReview ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-orange-600">확인필요</span>
                          <button
                            onClick={() => setBranchType(b.id, "지점")}
                            className="text-xs border rounded px-2 py-0.5"
                          >
                            지점
                          </button>
                          <button
                            onClick={() => setBranchType(b.id, "대리점")}
                            className="text-xs border rounded px-2 py-0.5"
                          >
                            대리점
                          </button>
                        </div>
                      ) : (
                        <span className="text-gray-500">{b.branchType}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

function RegionLinksSection({ regions }: { regions: Region[] }) {
  const [baseUrl, setBaseUrl] = useState("");

  function linkFor(regionId: string) {
    const base = baseUrl || (typeof window !== "undefined" ? window.location.origin : "");
    return `${base}/s/${regionId}`;
  }

  function downloadLinkList() {
    const lines = regions.map((r) => `${r.name}\t${linkFor(r.id)}`);
    const content = "지역본부\t링크\n" + lines.join("\n");
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "지역본부별_전수조사_링크.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="bg-white border rounded-lg p-4 space-y-3">
      <h2 className="font-bold">지역본부별 공유 링크</h2>
      <p className="text-sm text-gray-500">
        지역본부마다 아래 링크를 각각 전달해주세요. 그 링크로 들어오면 해당 지역본부 소속
        지점/대리점 목록만 보입니다.
      </p>
      <input
        value={baseUrl}
        onChange={(e) => setBaseUrl(e.target.value)}
        placeholder="배포 도메인 (예: https://bms-fullcheck.web.app) — 비워두면 현재 접속 주소 사용"
        className="border rounded px-3 py-2 w-full text-sm"
      />
      <button onClick={downloadLinkList} className="bg-gray-900 text-white rounded px-4 py-2 text-sm">
        전체 링크 목록 다운로드 (.txt)
      </button>
      <div className="max-h-64 overflow-y-auto border rounded">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="text-left px-3 py-2">지역본부</th>
              <th className="text-left px-3 py-2">링크</th>
            </tr>
          </thead>
          <tbody>
            {regions.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2 whitespace-nowrap">{r.name}</td>
                <td className="px-3 py-2">
                  <a href={linkFor(r.id)} target="_blank" className="text-blue-600 underline break-all">
                    {linkFor(r.id)}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
