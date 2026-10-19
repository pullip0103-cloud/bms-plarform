"use client";

import { useState } from "react";
import {
  STATUS_LABEL,
  STATUS_BADGE_COLOR,
  type ItemStatus,
} from "@/lib/constants";
import PhotoLightbox from "@/app/components/PhotoLightbox";

export type HqItem = {
  id: string;
  itemType: string;
  note: string | null;
  status: ItemStatus;
  photoPath: string;
  actionPhotoPath: string | null;
  regionRejectReason: string | null;
  hqRejectReason: string | null;
  branch: { name: string; branchType: string } | null;
  region: { id: string; name: string } | null;
  directiveCode: { id: string; label: string; description: string | null } | null;
};

export type DirectiveCodeOption = {
  id: string;
  label: string;
  description: string | null;
  requiresAction: boolean;
};

export type RegionStatus = {
  id: string;
  name: string;
  isSubmitted: boolean;
  isClosed: boolean;
};

const ALL_STATUSES = Object.keys(STATUS_LABEL) as ItemStatus[];

export default function HqBoard({
  initialItems,
  directiveCodes,
  regionStatuses,
}: {
  initialItems: HqItem[];
  directiveCodes: DirectiveCodeOption[];
  regionStatuses: RegionStatus[];
}) {
  const [items, setItems] = useState(initialItems);
  const [regions, setRegions] = useState(regionStatuses);
  // 기본값 = 전체 선택 (필터 없음 = 전체 보임). 사용자가 선택적으로만 좁힌다.
  const [selectedStatuses, setSelectedStatuses] = useState<Set<ItemStatus>>(
    new Set(ALL_STATUSES)
  );
  const [showRegionPanel, setShowRegionPanel] = useState(false);
  const [closeBusyId, setCloseBusyId] = useState<string | null>(null);

  const counts: Record<string, number> = {};
  for (const s of ALL_STATUSES) counts[s] = 0;
  for (const i of items) counts[i.status] = (counts[i.status] ?? 0) + 1;

  const visible = items.filter((i) => selectedStatuses.has(i.status));

  // 칩을 누르면 "그 상태만 보기"로 좁힌다. 이미 그 상태만 선택된 채로 같은 칩을
  // 다시 누르면 전체 보기로 돌아간다. 기본값(아무것도 안 누른 상태)은 항상 전체.
  function toggleStatus(s: ItemStatus) {
    setSelectedStatuses((prev) => {
      if (prev.size === 1 && prev.has(s)) {
        return new Set(ALL_STATUSES);
      }
      return new Set([s]);
    });
  }

  function showAll() {
    setSelectedStatuses(new Set(ALL_STATUSES));
  }

  async function assignDirective(itemId: string, directiveCodeId: string) {
    const res = await fetch(`/api/hq/items/${itemId}/directive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ directiveCodeId }),
    });
    if (!res.ok) {
      alert("지침 부여에 실패했습니다.");
      return;
    }
    const { item } = await res.json();
    const code = directiveCodes.find((c) => c.id === directiveCodeId);
    setItems((prev) =>
      prev.map((i) =>
        i.id === itemId
          ? {
              ...i,
              status: item.status,
              directiveCode: code
                ? { id: code.id, label: code.label, description: code.description }
                : null,
            }
          : i
      )
    );
  }

  async function finalApprove(itemId: string) {
    const res = await fetch(`/api/hq/items/${itemId}/approve`, { method: "POST" });
    if (!res.ok) {
      alert("승인에 실패했습니다.");
      return;
    }
    const { item } = await res.json();
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, status: item.status } : i)));
  }

  async function finalReject(itemId: string) {
    const reason = prompt("반려 사유를 입력해주세요 (조치결과 사진이 불명확한 경우 등)");
    if (!reason) return;
    const res = await fetch(`/api/hq/items/${itemId}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      alert("반려 처리에 실패했습니다.");
      return;
    }
    const { item } = await res.json();
    setItems((prev) =>
      prev.map((i) =>
        i.id === itemId ? { ...i, status: item.status, hqRejectReason: reason } : i
      )
    );
  }

  function isRegionClosed(regionId: string | undefined) {
    return !!regionId && regions.find((r) => r.id === regionId)?.isClosed === true;
  }

  async function toggleClose(regionId: string) {
    setCloseBusyId(regionId);
    try {
      const res = await fetch(`/api/hq/regions/${regionId}/close`, { method: "POST" });
      if (!res.ok) {
        alert("처리에 실패했습니다.");
        return;
      }
      const { isClosed } = await res.json();
      setRegions((prev) => prev.map((r) => (r.id === regionId ? { ...r, isClosed } : r)));
    } finally {
      setCloseBusyId(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4">
        <div className="flex justify-between items-start gap-4">
          <div>
            <h1 className="text-lg font-bold">본사 전체 현황</h1>
            <p className="text-sm text-gray-500">
              지역본부 확인 여부와 무관하게 전체 지역본부·지점의 모든 건이 표시됩니다.
            </p>
          </div>
          {regions.length > 0 && (
            <button
              onClick={() => setShowRegionPanel((v) => !v)}
              className="text-sm px-3 py-1.5 rounded border font-medium whitespace-nowrap"
            >
              지역본부별 마감 관리
            </button>
          )}
        </div>

        {showRegionPanel && (
          <div className="mt-3 border rounded-lg p-3 grid grid-cols-2 md:grid-cols-4 gap-2">
            {regions.map((r) => (
              <div key={r.id} className="flex items-center justify-between border rounded px-3 py-2 text-sm">
                <div>
                  <p className="font-medium">{r.name}</p>
                  <p className="text-xs text-gray-400">
                    {r.isSubmitted ? "제출됨" : "제출 전"}
                  </p>
                </div>
                <button
                  onClick={() => toggleClose(r.id)}
                  disabled={closeBusyId === r.id}
                  className={`text-xs px-2 py-1 rounded ${
                    r.isClosed ? "bg-gray-700 text-white" : "bg-red-50 text-red-700"
                  }`}
                >
                  {r.isClosed ? "마감 해제" : "마감"}
                </button>
              </div>
            ))}
          </div>
        )}
      </header>

      <div className="px-6 py-3 flex flex-wrap gap-2 items-center">
        <button
          onClick={showAll}
          className="px-3 py-1 rounded-full text-sm font-medium bg-gray-900 text-white"
        >
          전체 보기
        </button>
        {ALL_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => toggleStatus(s)}
            className={`px-3 py-1 rounded-full text-sm border ${
              selectedStatuses.has(s) ? "bg-white border-gray-900" : "bg-gray-100 text-gray-400"
            }`}
          >
            {STATUS_LABEL[s]} ({counts[s] ?? 0})
          </button>
        ))}
      </div>

      <main className="px-6 py-2 space-y-3">
        {visible.length === 0 && (
          <p className="text-gray-400 text-center py-10">표시할 항목이 없습니다.</p>
        )}
        {visible.map((item) => (
          <div key={item.id} className="bg-white border rounded-lg p-4 flex gap-4">
            <PhotoLightbox path={item.photoPath} />
            <div className="flex-1">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold">
                    {item.region?.name} · {item.branch?.name}{" "}
                    <span className="text-gray-400 text-sm">({item.branch?.branchType})</span>
                  </p>
                  <p className="text-sm text-gray-600">{item.itemType}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${STATUS_BADGE_COLOR[item.status]}`}>
                  {STATUS_LABEL[item.status]}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">비고: {item.note || "-"}</p>

              {item.regionRejectReason && (
                <p className="text-sm text-red-600">지역본부 반려 사유: {item.regionRejectReason}</p>
              )}
              {item.hqRejectReason && (
                <p className="text-sm text-red-600">본사 반려 사유: {item.hqRejectReason}</p>
              )}

              {item.status === "REGION_APPROVED" && !isRegionClosed(item.region?.id) && (
                <div className="flex gap-2 mt-3 items-center flex-wrap">
                  <span className="text-sm text-gray-500">처리 지침:</span>
                  {directiveCodes.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => assignDirective(item.id, c.id)}
                      className="border rounded px-3 py-1 text-sm"
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              )}

              {item.directiveCode && (
                <p className="text-sm text-orange-700 mt-1">
                  처리 지침: {item.directiveCode.label}
                </p>
              )}

              {item.actionPhotoPath && (
                <div className="mt-2">
                  <p className="text-xs text-gray-500 mb-1">조치결과 사진</p>
                  <PhotoLightbox path={item.actionPhotoPath} size="sm" />
                </div>
              )}

              {item.status === "ACTION_SUBMITTED" && !isRegionClosed(item.region?.id) && (
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => finalApprove(item.id)}
                    className="bg-blue-600 text-white rounded px-4 py-1.5 text-sm font-medium"
                  >
                    최종 승인
                  </button>
                  <button
                    onClick={() => finalReject(item.id)}
                    className="border rounded px-4 py-1.5 text-sm font-medium"
                  >
                    반려
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}
