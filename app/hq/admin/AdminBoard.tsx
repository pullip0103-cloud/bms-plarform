"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

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
export type RegionStatus = {
  id: string;
  name: string;
  isSubmitted: boolean;
  isClosed: boolean;
  actionIsSubmitted: boolean;
  actionIsClosed: boolean;
  totalBranches: number;
  completedBranches: number;
  actionCompletedBranches: number;
  branches: { id: string; name: string; branchType: string; isCompleted: boolean; isActionCompleted: boolean }[];
};

export default function AdminBoard({
  rounds,
  regions,
  branches,
  activeRound,
  initialCodes,
  regionStatuses,
}: {
  rounds: Round[];
  regions: Region[];
  branches: Branch[];
  activeRound: Round | null;
  initialCodes: Code[];
  regionStatuses: RegionStatus[];
}) {
  const [codes, setCodes] = useState(initialCodes);
  const [newRoundName, setNewRoundName] = useState("");
  const [newCodeLabel, setNewCodeLabel] = useState("");
  const [newCodeDesc, setNewCodeDesc] = useState("");
  const [newCodeRequiresAction, setNewCodeRequiresAction] = useState(true);
  const [newBranchName, setNewBranchName] = useState("");
  const [newBranchType, setNewBranchType] = useState<"지점" | "대리점">("지점");
  const [newBranchRegion, setNewBranchRegion] = useState(regions[0]?.id ?? "");
  const [branchList, setBranchList] = useState(branches);
  const [showOnlyReview, setShowOnlyReview] = useState(false);
  const [filterRegion, setFilterRegion] = useState<string>("ALL");
  const [filterType, setFilterType] = useState<"ALL" | "지점" | "대리점">("ALL");

  const reviewCount = branchList.filter((b) => b.needsTypeReview).length;
  const visibleBranches = useMemo(() => {
    let list = showOnlyReview ? branchList.filter((b) => b.needsTypeReview) : branchList;
    if (filterRegion !== "ALL") list = list.filter((b) => b.regionId === filterRegion);
    if (filterType !== "ALL") list = list.filter((b) => b.branchType === filterType);
    return list;
  }, [branchList, showOnlyReview, filterRegion, filterType]);

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

  async function reopenRound(roundId: string) {
    if (!confirm("이 라운드를 다시 진행중으로 되돌릴까요? 현재 진행중인 다른 라운드가 있다면 마감됩니다.")) return;
    const res = await fetch(`/api/hq/rounds/${roundId}/reopen`, { method: "POST" });
    if (!res.ok) {
      alert("처리에 실패했습니다.");
      return;
    }
    alert("다시 진행중으로 되돌렸습니다. 페이지를 새로고침해주세요.");
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
      body: JSON.stringify({ name: newBranchName.trim(), regionId: newBranchRegion, branchType: newBranchType }),
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

  // 지점을 실제로 지우지 않고 isActive=false로 숨긴다 — 이미 등록한
  // 제작물(items)이 그 지점을 참조하고 있을 수 있어서, 하드 삭제 대신
  // 기존 조회 쿼리들(isActive==true 필터)에서 자동으로 빠지게 한다.
  async function deleteBranch(id: string, name: string) {
    if (!confirm(`"${name}"을(를) 목록에서 삭제할까요? 이미 등록된 제작물 기록은 그대로 남아있습니다.`)) return;
    const res = await fetch(`/api/hq/branches/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: false }),
    });
    if (!res.ok) {
      alert("삭제에 실패했습니다.");
      return;
    }
    setBranchList((prev) => prev.filter((b) => b.id !== id));
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4">
        <h1 className="text-lg font-bold">본사 관리 설정</h1>
        <p className="text-sm text-gray-500">반기 라운드 · 처리지침 코드 · 지점 관리</p>
      </header>

      <main className="px-6 py-4 space-y-8 max-w-5xl">
        {/* 지역본부별 마감 현황 */}
        {activeRound && <RegionStatusSection regionStatuses={regionStatuses} />}

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
              <li key={r.id} className="flex items-center gap-2">
                <span>{r.name} — {r.status}</span>
                {r.status !== "진행중" && (
                  <button
                    onClick={() => reopenRound(r.id)}
                    className="text-xs border rounded px-2 py-0.5 text-blue-600"
                  >
                    다시 진행중으로
                  </button>
                )}
                <Link href={`/hq/admin/rounds/${r.id}`} className="text-xs text-gray-400 underline">
                  데이터 보기
                </Link>
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
                  <li
                    key={c.id}
                    className={`flex justify-between items-center border rounded px-3 py-2 ${
                      c.requiresAction ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"
                    }`}
                  >
                    <div>
                      <span className={`font-medium ${c.requiresAction ? "text-red-700" : "text-green-700"}`}>
                        {c.label}
                      </span>
                      {c.description && (
                        <span className="text-sm text-gray-500 ml-2">{c.description}</span>
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
                <div className="flex rounded-lg border overflow-hidden text-sm font-medium">
                  <button
                    type="button"
                    onClick={() => setNewCodeRequiresAction(false)}
                    className={`px-3 py-2 ${!newCodeRequiresAction ? "bg-green-600 text-white" : "bg-green-50 text-green-700"}`}
                  >
                    초록 (유지류, 조치 불필요)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewCodeRequiresAction(true)}
                    className={`px-3 py-2 ${newCodeRequiresAction ? "bg-red-600 text-white" : "bg-red-50 text-red-700"}`}
                  >
                    빨강 (조치 필요)
                  </button>
                </div>
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

          <div className="flex gap-2 flex-wrap items-center">
            <input
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              placeholder="지점명/대리점명"
              className="border rounded px-3 py-2"
            />
            <div className="flex rounded-lg border overflow-hidden text-sm font-medium">
              {(["지점", "대리점"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setNewBranchType(t)}
                  className={`px-3 py-2 ${newBranchType === t ? "bg-gray-900 text-white" : "bg-white text-gray-600"}`}
                >
                  {t}
                </button>
              ))}
            </div>
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

          <div className="flex gap-2 flex-wrap items-center">
            <select
              value={filterRegion}
              onChange={(e) => setFilterRegion(e.target.value)}
              className="border rounded px-3 py-1.5 text-sm"
            >
              <option value="ALL">전체 지역본부</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <div className="flex rounded-lg border overflow-hidden text-sm font-medium">
              {(["ALL", "지점", "대리점"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setFilterType(t)}
                  className={`px-3 py-1.5 ${filterType === t ? "bg-gray-900 text-white" : "bg-white text-gray-600"}`}
                >
                  {t === "ALL" ? "전체" : t}
                </button>
              ))}
            </div>
            <span className="text-sm text-gray-400">{visibleBranches.length}개 표시중</span>
          </div>

          <div className="max-h-[32rem] overflow-y-auto border rounded">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2">지역본부</th>
                  <th className="text-left px-3 py-2">지점명</th>
                  <th className="text-left px-3 py-2">구분</th>
                  <th className="text-left px-3 py-2"></th>
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
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => deleteBranch(b.id, b.name)}
                        className="text-xs border border-red-200 text-red-600 rounded px-2 py-0.5 hover:bg-red-50"
                      >
                        삭제
                      </button>
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

function RegionStatusSection({ regionStatuses }: { regionStatuses: RegionStatus[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <section className="bg-white border rounded-lg p-4 space-y-3">
      <h2 className="font-bold">지역본부별 마감 현황</h2>
      <p className="text-sm text-gray-500">
        펼치면 소속 지점/대리점 전체가 마감/미마감 뱃지로 보입니다.
      </p>
      <div className="border rounded divide-y">
        {regionStatuses.map((r) => {
          const isOpen = expanded.has(r.id);
          const branchTypeOrder: Record<string, number> = { 지점: 0, 대리점: 1 };
          const sortedBranches = [...r.branches].sort((a, b) => {
            const ai = branchTypeOrder[a.branchType] ?? 2;
            const bi = branchTypeOrder[b.branchType] ?? 2;
            if (ai !== bi) return ai - bi;
            return a.name.localeCompare(b.name, "ko");
          });
          return (
            <div key={r.id}>
              <div className="flex items-center justify-between px-3 py-2.5 flex-wrap gap-y-2">
                <Link href={`/hq/${r.id}`} className="font-medium text-blue-600 hover:underline">
                  {r.name}
                </Link>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">제작물 전송</span>
                    <span className="text-sm text-gray-500">
                      {r.completedBranches}/{r.totalBranches} 마감
                    </span>
                    {r.isClosed ? (
                      <span className="text-xs font-medium px-2 py-1 rounded bg-gray-700 text-white">
                        본사 마감
                      </span>
                    ) : r.isSubmitted ? (
                      <span className="text-xs font-medium px-2 py-1 rounded bg-blue-100 text-blue-800">
                        지역본부 마감
                      </span>
                    ) : (
                      <span className="text-xs font-medium px-2 py-1 rounded bg-amber-100 text-amber-800">
                        지역본부 확인중
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">처리결과</span>
                    <span className="text-sm text-gray-500">
                      {r.actionCompletedBranches}/{r.totalBranches} 마감
                    </span>
                    {r.actionIsClosed ? (
                      <span className="text-xs font-medium px-2 py-1 rounded bg-gray-700 text-white">
                        본사 마감
                      </span>
                    ) : r.actionIsSubmitted ? (
                      <span className="text-xs font-medium px-2 py-1 rounded bg-blue-100 text-blue-800">
                        지역본부 마감
                      </span>
                    ) : (
                      <span className="text-xs font-medium px-2 py-1 rounded bg-amber-100 text-amber-800">
                        지역본부 확인중
                      </span>
                    )}
                  </div>
                  {r.totalBranches > 0 && (
                    <button
                      onClick={() => toggle(r.id)}
                      className="text-xs text-gray-500 border rounded px-2 py-1"
                    >
                      지점/대리점 {isOpen ? "닫기" : "보기"}
                    </button>
                  )}
                </div>
              </div>
              {isOpen && (
                <div className="px-3 pb-3 space-y-2">
                  {(["지점", "대리점"] as const).map((type) => {
                    const group = sortedBranches.filter((b) => b.branchType === type);
                    if (group.length === 0) return null;
                    return (
                      <div key={type}>
                        <p className="text-xs font-bold text-gray-400 mb-1">{type}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {group.map((b) => (
                            <span
                              key={b.id}
                              className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full border ${
                                b.isCompleted
                                  ? "bg-green-50 text-green-700 border-green-200"
                                  : "bg-amber-50 text-amber-700 border-amber-200"
                              }`}
                            >
                              {b.name}
                              <span className="font-semibold">
                                전송 {b.isCompleted ? "마감" : "미마감"}
                              </span>
                              <span
                                className={`font-semibold ${
                                  b.isActionCompleted ? "text-green-700" : "text-amber-700"
                                }`}
                              >
                                처리결과 {b.isActionCompleted ? "마감" : "미마감"}
                              </span>
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RegionLinksSection({ regions }: { regions: Region[] }) {
  const [baseUrl, setBaseUrl] = useState("");
  // 서버 렌더링 시점에는 window가 없어 origin을 알 수 없다 — 하이드레이션
  // 불일치를 피하기 위해 클라이언트에서 마운트된 뒤에만 origin을 채운다.
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 서버에는 없는 window.location을 마운트 후에만 읽어야 함
    setOrigin(window.location.origin);
  }, []);

  function base() {
    return baseUrl || origin;
  }
  function branchLinkFor(regionId: string) {
    return `${base()}/s/${regionId}`;
  }
  function regionLinkFor(regionId: string) {
    return `${base()}/r/${regionId}`;
  }

  function downloadLinkList() {
    const lines = regions.map(
      (r) => `${r.name}\t지점/대리점용: ${branchLinkFor(r.id)}\t지역본부용: ${regionLinkFor(r.id)}`
    );
    const content = "지역본부\t지점/대리점용 링크\t지역본부용 링크\n" + lines.join("\n");
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
        지역본부마다 아래 두 링크를 각각 전달해주세요. 지점/대리점용 링크로 들어오면 해당
        지역본부 소속 지점/대리점 목록이, 지역본부용 링크로 들어오면 해당 지역본부 전체
        현황과 &quot;전체 제출&quot; 버튼이 보입니다. 로그인은 필요 없으며, 링크 자체가 접근 권한입니다.
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
      <div className="max-h-96 overflow-y-auto border rounded">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="text-left px-3 py-2">지역본부</th>
              <th className="text-left px-3 py-2">지점/대리점용 링크</th>
              <th className="text-left px-3 py-2">지역본부용 링크</th>
            </tr>
          </thead>
          <tbody>
            {regions.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2 whitespace-nowrap">{r.name}</td>
                <td className="px-3 py-2">
                  <a href={branchLinkFor(r.id)} target="_blank" className="text-blue-600 underline break-all">
                    {branchLinkFor(r.id)}
                  </a>
                </td>
                <td className="px-3 py-2">
                  <a href={regionLinkFor(r.id)} target="_blank" className="text-blue-600 underline break-all">
                    {regionLinkFor(r.id)}
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
