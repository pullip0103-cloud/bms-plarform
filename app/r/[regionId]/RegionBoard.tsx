"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DERIVED_STATE_LABEL, DERIVED_STATE_BADGE_COLOR } from "@/lib/constants";
import { deriveItemState } from "@/lib/itemProgress";
import { TACTILE_BUTTON } from "@/lib/tactileButton";
import PhotoLightbox from "@/app/components/PhotoLightbox";
import ScreenBadge from "@/app/components/ScreenBadge";

export type RegionItem = {
  id: string;
  note: string | null;
  photoPath: string;
  actionPhotoPath: string | null;
  actionNote: string | null;
  branchId: string;
  branch: { name: string; branchType: string } | null;
  directiveCode: { label: string; description: string | null; requiresAction: boolean } | null;
};

export type RegionBranch = {
  id: string;
  name: string;
  branchType: string;
  submissionCompleted: boolean;
  actionCompleted: boolean;
};

export type RegionLock = {
  submissionRegionClosed: boolean;
  actionRegionClosed: boolean;
  submissionHqClosed: boolean;
  actionHqClosed: boolean;
  directivePublished: boolean;
};

export type RoundOption = {
  id: string;
  name: string;
  status: string;
};

type BranchTypeFilter = "ALL" | "지점" | "대리점";
const BRANCH_TYPE_ORDER: Record<string, number> = { 지점: 0, 대리점: 1 };

export default function RegionBoard({
  regionId,
  regionName,
  initialItems,
  branches,
  activeRoundName,
  initialLock,
  rounds,
  selectedRoundId,
  isPastRound,
}: {
  regionId: string;
  regionName: string;
  initialItems: RegionItem[];
  branches: RegionBranch[];
  activeRoundName: string | null;
  initialLock: RegionLock;
  rounds: RoundOption[];
  selectedRoundId: string | null;
  isPastRound: boolean;
}) {
  const router = useRouter();
  // 자동 새로고침은 없다 — Firestore 읽기 할당량을 아끼기 위해 "새로고침"
  // 버튼을 눌러야만 다시 불러온다(수백 개 지점이 동시에 화면을 켜두는
  // 실 운영 규모를 고려한 설계 결정).
  const [items, setItems] = useState(initialItems);
  const [lock, setLock] = useState(initialLock);
  const [submissionBusy, setSubmissionBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  // 전체 지점/대리점 보기(기본) / 특정 한 곳만 보기. 목록은 가나다순(서버에서
  // 이미 name 기준으로 정렬되어 내려온다).
  const [selectedBranchId, setSelectedBranchId] = useState<string>("ALL");
  // 전체/지점/대리점 구분 필터. "전체"를 선택하면 지점 전체가 먼저, 대리점
  // 전체가 그다음 이어서 나온다.
  const [branchTypeFilter, setBranchTypeFilter] = useState<BranchTypeFilter>("ALL");

  const incompleteSubmission = branches.filter((b) => !b.submissionCompleted);
  const incompleteAction = branches.filter((b) => !b.actionCompleted);
  const allSubmissionComplete = incompleteSubmission.length === 0;
  const allActionComplete = incompleteAction.length === 0;

  const branchesForFilter =
    branchTypeFilter === "ALL" ? branches : branches.filter((b) => b.branchType === branchTypeFilter);

  const byBranchType =
    branchTypeFilter === "ALL" ? items : items.filter((i) => i.branch?.branchType === branchTypeFilter);
  const byBranch = selectedBranchId === "ALL"
    ? byBranchType
    : byBranchType.filter((i) => i.branchId === selectedBranchId);

  const visible = useMemo(() => {
    const branch = (branchId: string) => branches.find((b) => b.id === branchId);
    const branchName = (branchId: string) => branch(branchId)?.name ?? "";
    const branchTypeOrder = (branchId: string) =>
      BRANCH_TYPE_ORDER[branch(branchId)?.branchType ?? ""] ?? 2;
    return [...byBranch].sort((a, b) => {
      const ai = branchTypeOrder(a.branchId);
      const bi = branchTypeOrder(b.branchId);
      if (ai !== bi) return ai - bi;
      return branchName(a.branchId).localeCompare(branchName(b.branchId), "ko");
    });
  }, [byBranch, branches]);

  async function patchItem(itemId: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/region/${regionId}/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      alert("수정에 실패했습니다. 다시 시도해주세요.");
      return;
    }
    const { item } = await res.json();
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, ...item } : i)));
  }

  // 마감: 소속 활성 지점 전원이 해당 프로세스를 마감해야만 켤 수 있다(서버에서도
  // 검증). 끄는(마감 해제) 것은 전원완료 여부와 무관하게 항상 가능.
  async function toggleLock(process: "submission" | "action") {
    const setBusy = process === "submission" ? setSubmissionBusy : setActionBusy;
    setBusy(true);
    try {
      const res = await fetch(`/api/region/${regionId}/lock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ process }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.error === "REGION_CLOSED") {
          alert("본사가 이미 마감한 프로세스입니다.");
        } else if (data.error === "BRANCHES_NOT_COMPLETE") {
          alert(`아직 마감하지 않은 지점/대리점이 ${data.incompleteCount}곳 있습니다 (전체 ${data.totalCount}곳 중).`);
        } else {
          alert("처리에 실패했습니다.");
        }
        return;
      }
      const { closed } = await res.json();
      setLock((prev) => ({
        ...prev,
        [process === "submission" ? "submissionRegionClosed" : "actionRegionClosed"]: closed,
      }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ScreenBadge label="지역본부용" />
      <header className="bg-white border-b px-4 md:px-6 py-4 space-y-3">
        <div className="flex justify-between items-start gap-4">
          <div>
            <h1 className="text-2xl font-bold">{regionName} 현황</h1>
            <p className="text-base text-gray-500">
              {activeRoundName ? `${activeRoundName} · ` : ""}소속 지점의 전수조사 제출 현황
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedRoundId ?? ""}
              onChange={(e) => {
                const params = new URLSearchParams();
                if (e.target.value) params.set("roundId", e.target.value);
                router.push(`/r/${regionId}${params.toString() ? `?${params.toString()}` : ""}`);
              }}
              className="text-sm border rounded px-2 py-1.5"
            >
              {rounds.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} {r.status !== "진행중" ? "(마감)" : ""}
                </option>
              ))}
            </select>
            <button
              onClick={() => location.reload()}
              className="text-sm text-gray-500 border rounded px-3 py-1.5 whitespace-nowrap"
            >
              새로고침
            </button>
          </div>
        </div>

        {isPastRound && (
          <p className="text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            과거 라운드(읽기전용) — {activeRoundName}. 조회만 가능하며 수정/마감 버튼은 비활성화됩니다.
          </p>
        )}

        {activeRoundName && !isPastRound && (
          <div className="flex flex-wrap gap-2">
            {lock.submissionHqClosed ? (
              <span className="inline-block text-sm px-4 py-2 rounded bg-gray-200 text-gray-500">
                본사 제작물 전송 마감됨
              </span>
            ) : (
              <button
                onClick={() => toggleLock("submission")}
                disabled={submissionBusy || (!lock.submissionRegionClosed && !allSubmissionComplete)}
                className={`${TACTILE_BUTTON} px-4 py-2.5 text-sm whitespace-nowrap ${
                  lock.submissionRegionClosed
                    ? "bg-white border text-gray-700"
                    : allSubmissionComplete
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-400"
                }`}
              >
                {lock.submissionRegionClosed
                  ? "제작물 전송 지역본부 마감 해제"
                  : `제작물 전송 지역본부 마감 (${branches.length - incompleteSubmission.length}/${branches.length})`}
              </button>
            )}

            {lock.actionHqClosed ? (
              <span className="inline-block text-sm px-4 py-2 rounded bg-gray-200 text-gray-500">
                본사 처리결과 마감됨
              </span>
            ) : (
              <button
                onClick={() => toggleLock("action")}
                disabled={actionBusy || (!lock.actionRegionClosed && !allActionComplete)}
                className={`${TACTILE_BUTTON} px-4 py-2.5 text-sm whitespace-nowrap ${
                  lock.actionRegionClosed
                    ? "bg-white border text-gray-700"
                    : allActionComplete
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-400"
                }`}
              >
                {lock.actionRegionClosed
                  ? "처리결과 입력 지역본부 마감 해제"
                  : `처리결과 입력 지역본부 마감 (${branches.length - incompleteAction.length}/${branches.length})`}
              </button>
            )}
          </div>
        )}

        {!isPastRound && !lock.submissionHqClosed && !lock.submissionRegionClosed && incompleteSubmission.length > 0 && (
          <div className="border border-amber-200 bg-amber-50 rounded-lg p-3">
            <p className="text-base font-medium text-amber-800 mb-1">
              아직 제작물 전송을 마감하지 않은 지점/대리점 ({incompleteSubmission.length}곳)
            </p>
            <p className="text-sm text-amber-700">
              {incompleteSubmission.map((b) => b.name).join(", ")}
            </p>
          </div>
        )}

        {!isPastRound && !lock.actionHqClosed && !lock.actionRegionClosed && incompleteAction.length > 0 && (
          <div className="border border-amber-200 bg-amber-50 rounded-lg p-3">
            <p className="text-base font-medium text-amber-800 mb-1">
              아직 처리결과 입력을 마감하지 않은 지점/대리점 ({incompleteAction.length}곳)
            </p>
            <p className="text-sm text-amber-700">
              {incompleteAction.map((b) => b.name).join(", ")}
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border overflow-hidden text-sm font-medium">
            {(["ALL", "지점", "대리점"] as BranchTypeFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => {
                  setBranchTypeFilter(f);
                  setSelectedBranchId("ALL");
                }}
                className={`px-3 py-1.5 ${branchTypeFilter === f ? "bg-gray-900 text-white" : "bg-white text-gray-600"}`}
              >
                {f === "ALL" ? "전체" : f}
              </button>
            ))}
          </div>
          <select
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value)}
            className="text-sm border rounded px-2 py-1.5"
          >
            <option value="ALL">
              {branchTypeFilter === "ALL" ? "전체 지점/대리점" : `전체 ${branchTypeFilter}`}
            </option>
            {branchesForFilter.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.branchType})
              </option>
            ))}
          </select>
        </div>
      </header>

      {/*
        지점 화면과 동일한 하나의 표 양식. 비고는 본사가 이 지역본부의
        제작물 전송을 마감하기 전까지 지역본부가 바로 고칠 수 있다(지점의
        마감 여부와 무관).
      */}
      <main className="px-4 md:px-6 py-4 pb-10">
        <div className="bg-white border rounded-lg overflow-x-auto">
          <table className="w-full text-base border-collapse">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-semibold whitespace-nowrap border-r">지역본부</th>
                <th className="text-left px-4 py-3 font-semibold whitespace-nowrap border-r">거점명</th>
                <th className="text-left px-4 py-3 font-semibold border-r">제작물 사진</th>
                <th className="text-left px-4 py-3 font-semibold border-r">비고</th>
                <th className="text-left px-4 py-3 font-semibold whitespace-nowrap border-r">처리 지침</th>
                <th className="text-left px-4 py-3 font-semibold border-r">처리 결과</th>
                <th className="text-left px-4 py-3 font-semibold whitespace-nowrap">상태</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-gray-400 py-10">
                    표시할 항목이 없습니다.
                  </td>
                </tr>
              )}
              {visible.map((item, idx) => {
                const branchType = (id: string) => branches.find((b) => b.id === id)?.branchType ?? "";
                const showGroupHeader =
                  branchTypeFilter === "ALL" &&
                  (idx === 0 || branchType(visible[idx - 1].branchId) !== branchType(item.branchId));
                const branchInfo = branches.find((b) => b.id === item.branchId);
                return (
                  <ItemRow
                    key={item.id}
                    item={item}
                    regionName={regionName}
                    groupHeader={showGroupHeader ? branchType(item.branchId) : null}
                    onPatch={(body) => patchItem(item.id, body)}
                    disabled={isPastRound || lock.submissionHqClosed}
                    submissionCompleted={branchInfo?.submissionCompleted ?? false}
                    actionCompleted={branchInfo?.actionCompleted ?? false}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

function NoteInput({
  value,
  onPatch,
  disabled,
}: {
  value: string | null;
  onPatch: (body: Record<string, unknown>) => Promise<void>;
  disabled: boolean;
}) {
  const [text, setText] = useState(value ?? "");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 서버에서 새로 불러온 값으로 입력칸을 동기화해야 함
    setText(value ?? "");
  }, [value]);

  return (
    <input
      value={text}
      disabled={disabled}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        if (text !== (value ?? "")) onPatch({ note: text });
      }}
      placeholder="추가 설명이 필요할 경우 남겨주세요"
      className="border rounded px-2 py-1 text-base w-full min-w-[10rem] disabled:bg-gray-50 disabled:text-gray-400"
    />
  );
}

function ItemRow({
  item,
  regionName,
  groupHeader,
  onPatch,
  disabled,
  submissionCompleted,
  actionCompleted,
}: {
  item: RegionItem;
  regionName: string;
  groupHeader: string | null;
  onPatch: (body: Record<string, unknown>) => Promise<void>;
  disabled: boolean;
  submissionCompleted: boolean;
  actionCompleted: boolean;
}) {
  const state = deriveItemState(item);
  return (
    <>
      {groupHeader && (
        <tr className="bg-gray-100">
          <td colSpan={7} className="px-4 py-1.5 text-sm font-bold text-gray-500">
            {groupHeader}
          </td>
        </tr>
      )}
      <tr className="border-b align-top">
        <td className="px-4 py-4 whitespace-nowrap border-r">{regionName}</td>
        <td className="px-4 py-4 whitespace-nowrap border-r">
          {item.branch?.name ?? "-"}
          <span className="text-gray-400"> ({item.branch?.branchType})</span>
        </td>
        <td className="px-4 py-4 border-r">
          <PhotoLightbox path={item.photoPath} />
        </td>
        <td className="px-4 py-4 border-r">
          <NoteInput value={item.note} onPatch={onPatch} disabled={disabled} />
        </td>
        <td className="px-4 py-4 border-r">
          {item.directiveCode ? (
            <div>
              <span
                className={`font-semibold ${item.directiveCode.requiresAction ? "text-red-700" : "text-green-700"}`}
              >
                {item.directiveCode.label}
              </span>
              {item.directiveCode.description && (
                <p className="text-sm text-gray-700 mt-0.5">{item.directiveCode.description}</p>
              )}
            </div>
          ) : (
            <span className="text-gray-300">-</span>
          )}
        </td>
        <td className="px-4 py-4 border-r">
          {item.actionPhotoPath ? (
            <>
              <PhotoLightbox path={item.actionPhotoPath} />
              {item.actionNote && <p className="text-sm text-gray-600 mt-1">{item.actionNote}</p>}
            </>
          ) : (
            <span className="text-gray-300">-</span>
          )}
        </td>
        <td className="px-4 py-4 whitespace-nowrap space-y-1">
          {state && (
            <span className={`block w-fit text-sm font-medium px-3 py-1.5 rounded ${DERIVED_STATE_BADGE_COLOR[state]}`}>
              {DERIVED_STATE_LABEL[state]}
            </span>
          )}
          {submissionCompleted && (
            <span className="block w-fit text-xs font-medium px-2 py-1 rounded bg-gray-700 text-white">
              {item.branch?.branchType ?? "지점"} 제작물 전송 마감
            </span>
          )}
          {actionCompleted && (
            <span className="block w-fit text-xs font-medium px-2 py-1 rounded bg-gray-500 text-white">
              {item.branch?.branchType ?? "지점"} 처리결과 입력 마감
            </span>
          )}
        </td>
      </tr>
    </>
  );
}
