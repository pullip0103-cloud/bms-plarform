"use client";

import { useMemo, useState } from "react";
import { ITEM_TYPES, STATUS_LABEL, STATUS_BADGE_COLOR, type ItemStatus } from "@/lib/constants";
import PhotoLightbox from "@/app/components/PhotoLightbox";

export type RegionItem = {
  id: string;
  itemType: string;
  note: string | null;
  status: ItemStatus;
  photoPath: string;
  actionPhotoPath: string | null;
  regionRejectReason: string | null;
  branch: { name: string; branchType: string } | null;
  directiveCode: { label: string; description: string | null } | null;
};

export default function RegionBoard({
  initialItems,
  activeRoundName,
  initialIsSubmitted,
  initialIsClosed,
}: {
  initialItems: RegionItem[];
  activeRoundName: string | null;
  initialIsSubmitted: boolean;
  initialIsClosed: boolean;
}) {
  const [items, setItems] = useState(initialItems);
  const [tab, setTab] = useState<"pending" | "all">("pending");
  const [isSubmitted, setIsSubmitted] = useState(initialIsSubmitted);
  const [isClosed] = useState(initialIsClosed);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const pending = useMemo(() => items.filter((i) => i.status === "SUBMITTED"), [items]);
  const visible = tab === "pending" ? pending : items;

  async function toggleSubmit() {
    setSubmitBusy(true);
    try {
      const res = await fetch("/api/region/submit", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error === "REGION_CLOSED" ? "본사가 이미 마감한 라운드입니다." : "처리에 실패했습니다.");
        return;
      }
      const { isSubmitted: next } = await res.json();
      setIsSubmitted(next);
    } finally {
      setSubmitBusy(false);
    }
  }

  async function approve(id: string) {
    const res = await fetch(`/api/region/items/${id}/approve`, { method: "POST" });
    if (!res.ok) {
      alert("처리에 실패했습니다.");
      return;
    }
    const { item } = await res.json();
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status: item.status } : i)));
  }

  async function reject(id: string) {
    const reason = prompt("반려 사유를 입력해주세요 (사진이 불명확한 경우 등)");
    if (!reason) return;
    const res = await fetch(`/api/region/items/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      alert("처리에 실패했습니다.");
      return;
    }
    const { item } = await res.json();
    setItems((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, status: item.status, regionRejectReason: reason } : i
      )
    );
  }

  async function saveEdit(id: string, itemType: string, note: string) {
    const res = await fetch(`/api/region/items/${id}/edit`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemType, note }),
    });
    if (!res.ok) {
      alert("수정에 실패했습니다.");
      return;
    }
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, itemType, note } : i)));
    setEditingId(null);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 space-y-2">
        <div className="flex justify-between items-start gap-4">
          <div>
            <h1 className="text-lg font-bold">지역본부 현황</h1>
            <p className="text-sm text-gray-500">
              {activeRoundName ? `${activeRoundName} · ` : ""}소속 지점의 전수조사 제출 현황
            </p>
          </div>
          {activeRoundName && (
            <div className="text-right">
              {isClosed ? (
                <span className="inline-block text-sm px-3 py-1.5 rounded bg-gray-200 text-gray-500">
                  본사 마감됨
                </span>
              ) : (
                <button
                  onClick={toggleSubmit}
                  disabled={submitBusy}
                  className={`text-sm px-3 py-1.5 rounded font-medium ${
                    isSubmitted ? "bg-gray-200 text-gray-700" : "bg-blue-600 text-white"
                  }`}
                >
                  {isSubmitted ? "제출 취소" : "제출하기"}
                </button>
              )}
              {isSubmitted && !isClosed && (
                <p className="text-xs text-gray-400 mt-1">
                  제출됨 — 소속 지점의 신규 등록·재제출이 중지됩니다 (조치결과 제출은 계속됩니다)
                </p>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="px-6 py-3 flex gap-2">
        <TabButton active={tab === "pending"} onClick={() => setTab("pending")}>
          확인 대기 ({pending.length})
        </TabButton>
        <TabButton active={tab === "all"} onClick={() => setTab("all")}>
          전체 ({items.length})
        </TabButton>
      </div>

      <main className="px-6 py-2 space-y-3 max-w-4xl">
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
                    {item.branch?.name} <span className="text-gray-400 text-sm">({item.branch?.branchType})</span>
                  </p>
                  {editingId === item.id ? (
                    <EditForm
                      item={item}
                      onCancel={() => setEditingId(null)}
                      onSave={(itemType, note) => saveEdit(item.id, itemType, note)}
                    />
                  ) : (
                    <p className="text-sm text-gray-600">{item.itemType}</p>
                  )}
                </div>
                <span className={`text-xs px-2 py-1 rounded ${STATUS_BADGE_COLOR[item.status]}`}>
                  {STATUS_LABEL[item.status]}
                </span>
              </div>

              {editingId !== item.id && (
                <>
                  <p className="text-sm text-gray-500 mt-1">비고: {item.note || "-"}</p>
                  {!isClosed && (
                    <button
                      onClick={() => setEditingId(item.id)}
                      className="text-xs text-blue-600 underline mt-1"
                    >
                      내용 수정
                    </button>
                  )}
                </>
              )}

              {item.directiveCode && (
                <p className="text-sm text-orange-700">처리 지침: {item.directiveCode.label}</p>
              )}
              {item.regionRejectReason && (
                <p className="text-sm text-red-600">반려 사유: {item.regionRejectReason}</p>
              )}

              {item.actionPhotoPath && (
                <div className="mt-2">
                  <p className="text-xs text-gray-500 mb-1">조치결과 사진</p>
                  <PhotoLightbox path={item.actionPhotoPath} size="sm" />
                </div>
              )}

              {item.status === "SUBMITTED" && !isClosed && (
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => approve(item.id)}
                    className="bg-blue-600 text-white rounded px-4 py-1.5 text-sm font-medium"
                  >
                    승인
                  </button>
                  <button
                    onClick={() => reject(item.id)}
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

function EditForm({
  item,
  onCancel,
  onSave,
}: {
  item: RegionItem;
  onCancel: () => void;
  onSave: (itemType: string, note: string) => void;
}) {
  const [itemType, setItemType] = useState(item.itemType);
  const [note, setNote] = useState(item.note ?? "");

  return (
    <div className="mt-1 space-y-2 bg-gray-50 border rounded p-2">
      <select
        value={itemType}
        onChange={(e) => setItemType(e.target.value)}
        className="border rounded px-2 py-1 text-sm w-full"
      >
        {ITEM_TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="비고"
        className="border rounded px-2 py-1 text-sm w-full"
      />
      <div className="flex gap-2">
        <button
          onClick={() => onSave(itemType, note)}
          className="bg-blue-600 text-white rounded px-3 py-1 text-xs"
        >
          저장
        </button>
        <button onClick={onCancel} className="border rounded px-3 py-1 text-xs">
          취소
        </button>
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 rounded-full text-sm font-medium ${
        active ? "bg-gray-900 text-white" : "bg-white border text-gray-600"
      }`}
    >
      {children}
    </button>
  );
}
