"use client";

import { useState } from "react";
import Link from "next/link";
import { DERIVED_STATE_LABEL, DERIVED_STATE_BADGE_COLOR } from "@/lib/constants";
import { deriveItemState } from "@/lib/itemProgress";
import { TACTILE_BUTTON } from "@/lib/tactileButton";
import PhotoLightbox from "@/app/components/PhotoLightbox";
import ScreenBadge from "@/app/components/ScreenBadge";

export type HqItem = {
  id: string;
  note: string | null;
  photoPath: string;
  actionPhotoPath: string | null;
  actionNote: string | null;
  branchId: string;
  branch: { name: string; branchType: string } | null;
  directiveCode: { id: string; label: string; description: string | null; requiresAction: boolean } | null;
};

export type DirectiveCodeOption = {
  id: string;
  label: string;
  description: string | null;
  requiresAction: boolean;
};

export type HqLock = {
  submissionRegionClosed: boolean;
  actionRegionClosed: boolean;
  submissionHqClosed: boolean;
  actionHqClosed: boolean;
  directivePublished: boolean;
};

type BranchTypeFilter = "ALL" | "지점" | "대리점";

export default function HqRegionBoard({
  regionId,
  regionName,
  initialItems,
  directiveCodes,
  initialLock,
}: {
  regionId: string;
  regionName: string;
  initialItems: HqItem[];
  directiveCodes: DirectiveCodeOption[];
  initialLock: HqLock;
}) {
  // 자동 새로고침은 없다 — Firestore 읽기 할당량을 아끼기 위해 "새로고침"
  // 버튼을 눌러야만 다시 불러온다.
  const [items, setItems] = useState(initialItems);
  const [lock, setLock] = useState(initialLock);
  const [busyProcess, setBusyProcess] = useState<"submission" | "action" | "directive" | null>(null);
  // 지점/대리점 구분 필터. "전체"가 기본값.
  const [branchTypeFilter, setBranchTypeFilter] = useState<BranchTypeFilter>("ALL");

  const visible = (
    branchTypeFilter === "ALL" ? items : items.filter((i) => i.branch?.branchType === branchTypeFilter)
  )
    .slice()
    .sort((a, b) => (a.branch?.name ?? "").localeCompare(b.branch?.name ?? "", "ko"));

  // 이미 선택된 코드를 다시 누르면 지침을 해제한다(directiveCodeId: null).
  async function assignDirective(itemId: string, directiveCodeId: string) {
    const current = items.find((i) => i.id === itemId);
    const nextCodeId = current?.directiveCode?.id === directiveCodeId ? null : directiveCodeId;
    const res = await fetch(`/api/hq/items/${itemId}/directive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ directiveCodeId: nextCodeId }),
    });
    if (!res.ok) {
      alert("지침 처리에 실패했습니다.");
      return;
    }
    const code = nextCodeId ? directiveCodes.find((c) => c.id === nextCodeId) : null;
    setItems((prev) =>
      prev.map((i) =>
        i.id === itemId
          ? {
              ...i,
              directiveCode: code
                ? { id: code.id, label: code.label, description: code.description, requiresAction: code.requiresAction }
                : null,
            }
          : i
      )
    );
  }

  async function toggleLock(process: "submission" | "action" | "directive") {
    setBusyProcess(process);
    try {
      const res = await fetch(`/api/hq/regions/${regionId}/lock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ process }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.error === "SUBMISSION_NOT_CLOSED") {
          alert("제작물 전송을 먼저 마감해야 처리 지침을 배포할 수 있습니다.");
        } else {
          alert("처리에 실패했습니다.");
        }
        return;
      }
      const { value } = await res.json();
      setLock((prev) => ({
        ...prev,
        [process === "submission" ? "submissionHqClosed" : process === "action" ? "actionHqClosed" : "directivePublished"]: value,
      }));
    } finally {
      setBusyProcess(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ScreenBadge label="본사용" />
      <header className="bg-white border-b px-6 py-4 space-y-3">
        <div className="flex justify-between items-start gap-4">
          <div>
            <Link href="/hq/admin" className="text-sm text-blue-600 font-medium">
              ← 관리 설정으로
            </Link>
            <div className="flex items-center gap-2 mt-1">
              <h1 className="text-2xl font-bold">{regionName} 전체 현황</h1>
              {lock.submissionRegionClosed && !lock.submissionHqClosed && (
                <span className="text-xs font-medium px-2 py-1 rounded bg-blue-100 text-blue-800">
                  지역본부 제작물 전송 마감
                </span>
              )}
              {lock.actionRegionClosed && !lock.actionHqClosed && (
                <span className="text-xs font-medium px-2 py-1 rounded bg-blue-100 text-blue-800">
                  지역본부 처리결과 입력 마감
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => location.reload()}
            className="text-sm text-gray-500 border rounded px-3 py-1.5 whitespace-nowrap"
          >
            새로고침
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => toggleLock("submission")}
            disabled={busyProcess === "submission"}
            className={`${TACTILE_BUTTON} px-4 py-2.5 text-sm whitespace-nowrap ${
              lock.submissionHqClosed ? "bg-gray-700 text-white" : "bg-red-50 text-red-700 border border-red-200"
            }`}
          >
            {lock.submissionHqClosed ? "제작물 전송 마감 해제" : "제작물 전송 마감"}
          </button>
          <button
            onClick={() => toggleLock("directive")}
            disabled={busyProcess === "directive" || !lock.submissionHqClosed}
            title={!lock.submissionHqClosed ? "제작물 전송을 먼저 마감해야 배포할 수 있습니다" : undefined}
            className={`${TACTILE_BUTTON} px-4 py-2.5 text-sm whitespace-nowrap ${
              !lock.submissionHqClosed
                ? "bg-gray-100 text-gray-400"
                : lock.directivePublished
                  ? "bg-gray-700 text-white"
                  : "bg-blue-600 text-white"
            }`}
          >
            {lock.directivePublished ? "처리 지침 배포 취소" : "처리 지침 배포"}
          </button>
          <button
            onClick={() => toggleLock("action")}
            disabled={busyProcess === "action"}
            className={`${TACTILE_BUTTON} px-4 py-2.5 text-sm whitespace-nowrap ${
              lock.actionHqClosed ? "bg-gray-700 text-white" : "bg-red-50 text-red-700 border border-red-200"
            }`}
          >
            {lock.actionHqClosed ? "처리결과 마감 해제" : "처리결과 마감"}
          </button>

          <div className="flex rounded-lg border overflow-hidden text-sm font-medium ml-auto">
            {(["ALL", "지점", "대리점"] as BranchTypeFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setBranchTypeFilter(f)}
                className={`px-3 py-1.5 ${branchTypeFilter === f ? "bg-gray-900 text-white" : "bg-white text-gray-600"}`}
              >
                {f === "ALL" ? "전체" : f}
              </button>
            ))}
          </div>
        </div>

        {!lock.directivePublished && (
          <p className="text-sm text-gray-400">
            처리 지침은 아직 배포되지 않았습니다 — 지역본부/지점 화면에는 보이지 않고, 여기서 입력한 내용은 초안으로만 저장됩니다.
          </p>
        )}
      </header>

      <main className="px-6 py-4 pb-10">
        <div className="bg-white border rounded-lg overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-3 py-2 font-medium whitespace-nowrap">거점명</th>
                <th className="text-left px-3 py-2 font-medium">제작물 사진</th>
                <th className="text-left px-3 py-2 font-medium">비고</th>
                <th className="text-left px-3 py-2 font-medium whitespace-nowrap">처리 지침</th>
                <th className="text-left px-3 py-2 font-medium">처리 결과</th>
                <th className="text-left px-3 py-2 font-medium whitespace-nowrap">상태</th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-gray-400 py-10">
                    표시할 항목이 없습니다.
                  </td>
                </tr>
              )}
              {visible.map((item) => (
                <ItemTableRow
                  key={item.id}
                  item={item}
                  directiveCodes={directiveCodes}
                  directivePublished={lock.directivePublished}
                  assignDirective={assignDirective}
                />
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

function ItemTableRow({
  item,
  directiveCodes,
  directivePublished,
  assignDirective,
}: {
  item: HqItem;
  directiveCodes: DirectiveCodeOption[];
  directivePublished: boolean;
  assignDirective: (itemId: string, directiveCodeId: string) => void;
}) {
  const state = deriveItemState(item);
  return (
    <tr className="border-b align-top">
      <td className="px-3 py-3 whitespace-nowrap">
        {item.branch?.name ?? "-"}
        <span className="text-gray-400"> ({item.branch?.branchType})</span>
      </td>
      <td className="px-3 py-3">
        <PhotoLightbox path={item.photoPath} size="sm" />
      </td>
      <td className="px-3 py-3 text-gray-600">{item.note ?? "-"}</td>
      <td className="px-3 py-3">
        {/*
          본사는 건의 조치결과 진행 여부나 마감 상태와 무관하게 처리지침을
          언제든 입력/변경할 수 있다 — 입력 여부 자체가 본사의 선택이라
          프로세스로 막을 이유가 없다. 버튼은 라벨만 한 줄로 나열하고
          (스크롤 없이 한눈에), 설명은 공간을 쓰지 않도록 title 속성으로
          올려 커서를 올렸을 때만 보이게 한다. 미배포 상태면 "초안" 표시.
        */}
        {item.directiveCode && (
          <p className={`font-semibold mb-1.5 ${item.directiveCode.requiresAction ? "text-red-700" : "text-green-700"}`}>
            현재: {item.directiveCode.label}
            {!directivePublished && <span className="text-gray-400 font-normal"> (초안)</span>}
          </p>
        )}
        <div className="flex flex-wrap gap-1">
          {directiveCodes.map((c) => {
            const selected = item.directiveCode?.id === c.id;
            return (
              <button
                key={c.id}
                onClick={() => assignDirective(item.id, c.id)}
                title={c.description ?? undefined}
                className={`text-xs font-semibold rounded px-2 py-1 border whitespace-nowrap ${
                  selected ? "ring-2 ring-offset-1" : ""
                } ${
                  c.requiresAction
                    ? `border-red-200 bg-red-50 hover:bg-red-100 text-red-700 ${selected ? "ring-red-400" : ""}`
                    : `border-green-200 bg-green-50 hover:bg-green-100 text-green-700 ${selected ? "ring-green-400" : ""}`
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </td>
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
      <td className="px-3 py-3 whitespace-nowrap">
        {state ? (
          <span className={`text-xs px-2 py-1 rounded ${DERIVED_STATE_BADGE_COLOR[state]}`}>
            {DERIVED_STATE_LABEL[state]}
          </span>
        ) : (
          <span className="text-gray-300">-</span>
        )}
      </td>
    </tr>
  );
}
