"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { compressAndUpload } from "@/lib/uploadPhoto";
import { photoUrl } from "@/lib/photoUrl";
import { DERIVED_STATE_LABEL, DERIVED_STATE_BADGE_COLOR } from "@/lib/constants";
import { deriveItemState } from "@/lib/itemProgress";
import { TACTILE_BUTTON } from "@/lib/tactileButton";
import ScreenBadge from "@/app/components/ScreenBadge";

type Item = {
  id: string;
  note: string | null;
  photoPath: string;
  actionPhotoPath: string | null;
  actionNote: string | null;
  directiveCode: { label: string; description: string | null; requiresAction: boolean } | null;
  directiveComment: string | null;
};

type Ctx = {
  branchId: string;
  branchName: string;
  branchType: string;
  regionName: string;
  roundId: string;
  roundName: string;
  isPastRound: boolean;
  submissionRegionClosed: boolean;
  submissionHqClosed: boolean;
  actionRegionClosed: boolean;
  actionHqClosed: boolean;
  submissionCompleted: boolean;
  actionCompleted: boolean;
};

export default function BranchClient({
  regionId,
  branchId,
  roundId,
}: {
  regionId: string;
  branchId: string;
  roundId: string | null;
}) {
  const router = useRouter();
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [rounds, setRounds] = useState<{ id: string; name: string; status: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [actionTarget, setActionTarget] = useState<string | null>(null);

  const load = useCallback(async () => {
    const qs = roundId ? `?roundId=${roundId}` : "";
    const res = await fetch(`/api/branch/${branchId}/context${qs}`);
    if (!res.ok) {
      setError("지점 정보를 불러오지 못했거나 현재 진행중인 라운드가 없습니다. 담당자에게 확인해주세요.");
      setLoading(false);
      return;
    }
    const data = await res.json();
    setCtx(data.context);
    setItems(data.items);
    setRounds(data.rounds ?? []);
    setLoading(false);
  }, [branchId, roundId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 지점 데이터는 매번 서버에서 새로 불러와야 함
    void load();
  }, [load]);

  // 자동 새로고침은 없다 — Firestore 읽기 할당량을 아끼기 위해 "새로고침"
  // 버튼을 눌러야만 다시 불러온다(수백 개 지점이 동시에 화면을 켜두는
  // 실 운영 규모를 고려한 설계 결정).

  const [submissionBusy, setSubmissionBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  if (loading) return <Centered>불러오는 중...</Centered>;
  if (error) return <Centered>{error}</Centered>;
  if (!ctx) return null;

  const submissionLocked = ctx.submissionRegionClosed || ctx.submissionHqClosed;
  const canAddNew = !submissionLocked && !ctx.submissionCompleted;
  const actionLocked = ctx.actionRegionClosed || ctx.actionHqClosed;
  const hasActionItem = items.some((i) => i.directiveCode?.requiresAction);

  async function patchItem(itemId: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/branch/${branchId}/items/${itemId}`, {
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

  async function deleteItem(itemId: string) {
    if (!confirm("이 제작물을 삭제할까요? 되돌릴 수 없습니다.")) return;
    const res = await fetch(`/api/branch/${branchId}/items/${itemId}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (data.error === "DIRECTIVE_ASSIGNED") {
        alert("조치 지침이 배정된 제작물은 삭제할 수 없습니다.");
      } else {
        alert("삭제에 실패했습니다. 다시 시도해주세요.");
      }
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== itemId));
  }

  async function toggleLock(process: "submission" | "action") {
    const setBusy = process === "submission" ? setSubmissionBusy : setActionBusy;
    setBusy(true);
    try {
      const res = await fetch(`/api/branch/${branchId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ process }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.error === "ACTION_INCOMPLETE") {
          alert("조치가 안된 제작물이 있습니다. 모든 조치결과 사진을 올린 후 마감 버튼을 눌러주세요");
        } else {
          alert("처리에 실패했습니다.");
        }
        return;
      }
      const { completed } = await res.json();
      setCtx((prev) =>
        prev
          ? {
              ...prev,
              [process === "submission" ? "submissionCompleted" : "actionCompleted"]: completed,
            }
          : prev
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ScreenBadge label="지점/대리점용" />
      <header className="bg-white border-b px-4 md:px-6 py-4 sticky top-0 z-10 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Link href={`/s/${regionId}`} className="text-base text-blue-600 font-medium">
              ← 다른 지점/대리점 선택
            </Link>
            <p className="text-base text-gray-500 mt-1">
              {ctx.regionName} · {ctx.branchType}
            </p>
            <h1 className="text-2xl font-bold">{ctx.branchName}</h1>
            <p className="text-base text-gray-500">{ctx.roundName} 전수조사</p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={ctx.roundId}
              onChange={(e) => {
                const params = new URLSearchParams();
                if (e.target.value) params.set("roundId", e.target.value);
                router.push(`/s/${regionId}/${branchId}${params.toString() ? `?${params.toString()}` : ""}`);
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
              onClick={() => load()}
              className={`${TACTILE_BUTTON} text-sm bg-blue-600 text-white px-3 py-1.5 whitespace-nowrap`}
            >
              새로고침
            </button>
          </div>
        </div>

        {ctx.isPastRound && (
          <p className="text-sm font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            과거 라운드(읽기전용) — {ctx.roundName}. 조회만 가능하며 등록/수정/마감 버튼은 비활성화됩니다.
          </p>
        )}

        {/* 단계별로 필요한 버튼 하나만 보여준다 — 조치가 필요한 지침이
            배정된 건이 하나라도 있으면(hasActionItem) 이제부터는 조치결과
            입력 단계이므로 제작물 전송 섹션은 완전히 숨기고, 아니면 아직
            제작물 전송 단계이므로 조치결과 입력 섹션을 숨긴다. 두 버튼이
            동시에 보이면 지금 뭘 해야 하는지 헷갈린다는 사용자 피드백으로
            단계 분리(2026-10-27). */}
        {!ctx.isPastRound && !hasActionItem && (
          <div className="flex flex-wrap gap-2">
            {ctx.submissionHqClosed ? (
              <span className="inline-block text-sm px-4 py-2 rounded bg-gray-200 text-gray-500">
                본사 제작물 전송 마감됨
              </span>
            ) : ctx.submissionRegionClosed ? (
              <span className="inline-block text-sm px-4 py-2 rounded bg-gray-200 text-gray-500">
                지역본부 제작물 전송 마감됨
              </span>
            ) : (
              <button
                onClick={() => toggleLock("submission")}
                disabled={submissionBusy}
                className={`${TACTILE_BUTTON} px-4 py-2.5 text-sm whitespace-nowrap ${
                  ctx.submissionCompleted ? "bg-white border text-gray-700" : "bg-green-600 text-white"
                }`}
              >
                {ctx.submissionCompleted ? "제작물 전송 수정" : "제작물 전송 마감"}
              </button>
            )}
          </div>
        )}
        {!ctx.isPastRound && hasActionItem && (
          <div className="flex flex-wrap gap-2">
            {ctx.actionHqClosed ? (
              <span className="inline-block text-sm px-4 py-2 rounded bg-gray-200 text-gray-500">
                본사 조치결과 입력 마감됨
              </span>
            ) : ctx.actionRegionClosed ? (
              <span className="inline-block text-sm px-4 py-2 rounded bg-gray-200 text-gray-500">
                지역본부 조치결과 입력 마감됨
              </span>
            ) : (
              <button
                onClick={() => toggleLock("action")}
                disabled={actionBusy}
                className={`${TACTILE_BUTTON} px-4 py-2.5 text-sm whitespace-nowrap ${
                  ctx.actionCompleted ? "bg-white border text-gray-700" : "bg-green-600 text-white"
                }`}
              >
                {ctx.actionCompleted ? "조치결과 입력 수정" : "조치결과 입력 마감"}
              </button>
            )}
          </div>
        )}
      </header>

      <main className="px-4 md:px-6 py-4">
        {!hasActionItem && (
          <>
            {ctx.submissionHqClosed ? (
              <p className="text-base text-gray-600 bg-gray-100 border rounded-lg p-3 mb-3">
                본사가 제작물 전송을 마감했습니다. 더 이상 등록/수정이 불가합니다.
              </p>
            ) : ctx.submissionRegionClosed ? (
              <p className="text-base text-gray-600 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
                지역본부에서 제작물 전송을 마감했습니다. 새 제작물은 추가할 수 없습니다.
              </p>
            ) : ctx.submissionCompleted ? (
              <p className="text-base text-gray-600 bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
                제작물 전송이 마감 처리되었습니다. 더 등록할 내용이 있으면 위의 &quot;제작물 전송 수정&quot; 버튼을 눌러주세요.
              </p>
            ) : (
              <p className="text-base text-gray-600 mb-3">
                매장 내 제작물 사진을 아래 빈 칸의 버튼을 눌러 등록해주세요. 등록을 마치면 &quot;제작물 전송 마감&quot; 버튼을 눌러주세요.
              </p>
            )}
          </>
        )}

        {/* 조치가 필요한 지침이 배정된 건이 하나도 없으면(= 조치결과 입력
            자체가 이 지점에 해당 없음) 안내문을 보여주지 않는다. */}
        {hasActionItem && (
          <>
            {ctx.actionHqClosed ? (
              <p className="text-base text-gray-600 bg-gray-100 border rounded-lg p-3 mb-3">
                본사가 조치결과 입력을 마감했습니다. 더 이상 조치결과 사진을 올릴 수 없습니다.
              </p>
            ) : ctx.actionRegionClosed ? (
              <p className="text-base text-gray-600 bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
                지역본부에서 조치결과 입력을 마감했습니다. 더 이상 조치결과 사진을 올릴 수 없습니다.
              </p>
            ) : ctx.actionCompleted ? (
              <p className="text-base text-gray-600 bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
                조치결과 입력이 마감 처리되었습니다. 더 올릴 내용이 있으면 위의 &quot;조치결과 입력 수정&quot; 버튼을 눌러주세요.
              </p>
            ) : (
              <p className="text-base text-gray-600 mb-3">
                조치가 필요한 항목에 조치결과 사진을 올려주세요. 올리기를 마치면 &quot;조치결과 입력 마감&quot; 버튼을 눌러주세요.
              </p>
            )}
          </>
        )}

        {/* 모바일: 사진 찍기에 최적화된 세로 카드 목록. 맨 아래에 항상 빈 칸(추가 버튼)이 있다. */}
        <div className="md:hidden space-y-3">
          {items.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              onPatch={(body) => patchItem(item.id, body)}
              onDelete={() => deleteItem(item.id)}
              fullyLocked={submissionLocked || ctx.submissionCompleted}
              actionLocked={actionLocked || ctx.actionCompleted}
              onPickAction={() => setActionTarget(item.id)}
            />
          ))}
          {canAddNew && <AddItemCard onClick={() => setShowForm(true)} />}
          {!canAddNew && items.length === 0 && (
            <p className="text-center text-gray-400 py-10 text-base">등록된 제작물이 없습니다.</p>
          )}
        </div>

        {/* 데스크탑: 지역본부·본사 화면과 동일한 하나의 표 양식. 맨 아래 행이 항상 추가 버튼이다. */}
        <div className="hidden md:block bg-white border rounded-lg overflow-x-auto">
          <table className="w-full text-base border-collapse">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-semibold whitespace-nowrap border-r">지역본부</th>
                <th className="text-left px-4 py-3 font-semibold whitespace-nowrap border-r">거점명</th>
                <th className="text-left px-4 py-3 font-semibold border-r">제작물 사진</th>
                <th className="text-left px-4 py-3 font-semibold border-r">비고</th>
                <th className="text-left px-4 py-3 font-semibold whitespace-nowrap border-r">조치 지침</th>
                <th className="text-left px-4 py-3 font-semibold border-r">조치 결과</th>
                <th className="text-left px-4 py-3 font-semibold whitespace-nowrap border-r">상태</th>
                <th className="text-left px-4 py-3 font-semibold whitespace-nowrap"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  regionName={ctx.regionName}
                  branchName={ctx.branchName}
                  branchType={ctx.branchType}
                  onPatch={(body) => patchItem(item.id, body)}
                  onDelete={() => deleteItem(item.id)}
                  fullyLocked={submissionLocked || ctx.submissionCompleted}
                  actionLocked={actionLocked || ctx.actionCompleted}
                  onPickAction={() => setActionTarget(item.id)}
                />
              ))}
              {canAddNew && (
                <AddItemRow
                  regionName={ctx.regionName}
                  branchName={ctx.branchName}
                  branchType={ctx.branchType}
                  onClick={() => setShowForm(true)}
                />
              )}
              {!canAddNew && items.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-gray-400 py-10">
                    등록된 제작물이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>

      {showForm && (
        <NewItemForm
          branchId={branchId}
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

      {actionTarget && (
        <ActionPhotoForm
          branchId={branchId}
          itemId={actionTarget}
          onClose={() => setActionTarget(null)}
          onUploaded={() => {
            setActionTarget(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 text-center text-gray-600 text-base">
      {children}
    </div>
  );
}

// 비고 입력칸에서 벗어날 때(blur) 저장한다 — 여러 장을 한번에 올리고 필요한
// 건만 비고를 나중에 채우는 사용 흐름을 지원한다.
function NoteInput({
  value,
  onPatch,
  disabled,
  className,
}: {
  value: string | null;
  onPatch: (body: Record<string, unknown>) => Promise<void>;
  disabled: boolean;
  className?: string;
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
      className={`border rounded px-2 py-1 text-base w-full disabled:bg-gray-50 disabled:text-gray-400 ${className ?? ""}`}
    />
  );
}

function DirectiveDisplay({
  directiveCode,
  directiveComment,
}: {
  directiveCode: Item["directiveCode"];
  directiveComment: Item["directiveComment"];
}) {
  return (
    <div>
      <p
        className={`text-base font-semibold ${
          directiveCode ? (directiveCode.requiresAction ? "text-red-700" : "text-green-700") : "text-gray-400"
        }`}
      >
        조치 지침: {directiveCode ? directiveCode.label : <span className="font-normal">-</span>}
      </p>
      {directiveCode?.description && (
        <p className="text-sm text-gray-700 mt-0.5">{directiveCode.description}</p>
      )}
      {directiveComment && (
        <p className="text-base font-bold text-red-600 mt-1">{directiveComment}</p>
      )}
    </div>
  );
}

function StateBadge({ item }: { item: Item }) {
  const state = deriveItemState(item);
  if (!state) return <span className="text-gray-300">-</span>;
  return (
    <span className={`text-sm font-medium px-3 py-1.5 rounded ${DERIVED_STATE_BADGE_COLOR[state]}`}>
      {DERIVED_STATE_LABEL[state]}
    </span>
  );
}

// 모바일 카드 — 사진 찍기/확인에 최적화된 세로 레이아웃. 비고는 인라인으로
// 바로 고칠 수 있다.
function ItemCard({
  item,
  onPatch,
  onDelete,
  fullyLocked,
  actionLocked,
  onPickAction,
}: {
  item: Item;
  onPatch: (body: Record<string, unknown>) => Promise<void>;
  onDelete: () => void;
  fullyLocked: boolean;
  actionLocked: boolean;
  onPickAction: () => void;
}) {
  const needsAction = item.directiveCode?.requiresAction && !actionLocked;

  return (
    <div className="bg-white rounded-lg border p-3 space-y-2">
      <div className="flex justify-between items-center">
        <StateBadge item={item} />
        {!fullyLocked && !item.directiveCode && (
          <button onClick={onDelete} className="text-sm text-red-600">
            삭제
          </button>
        )}
      </div>

      <PhotoThumb path={item.photoPath} />

      <div>
        <p className="text-sm text-gray-500 mb-1">비고</p>
        <NoteInput value={item.note} onPatch={onPatch} disabled={fullyLocked} />
      </div>

      <DirectiveDisplay directiveCode={item.directiveCode} directiveComment={item.directiveComment} />

      <div>
        <p className="text-sm text-gray-500 mb-1">조치결과(조치결과) 사진</p>
        {item.actionPhotoPath ? (
          <>
            <PhotoThumb path={item.actionPhotoPath} />
            {item.actionNote && <p className="text-sm text-gray-600 mt-1">{item.actionNote}</p>}
          </>
        ) : (
          <div className="w-full h-20 border border-dashed rounded flex items-center justify-center text-gray-300 text-base">
            -
          </div>
        )}
      </div>

      {needsAction && (
        <button
          onClick={onPickAction}
          className={`${TACTILE_BUTTON} inline-block w-full text-center bg-gray-900 text-white py-3 text-base`}
        >
          {item.actionPhotoPath ? "조치결과 사진 다시 올리기" : "조치결과 사진 올리기"}
        </button>
      )}
    </div>
  );
}

// 모바일 목록 맨 아래에 항상 떠 있는 빈 칸 — 사진 자리를 누르면 등록이 시작된다.
function AddItemCard({ onClick }: { onClick: () => void }) {
  return (
    <div className="bg-white rounded-2xl border-2 border-dashed border-blue-300 p-3 space-y-2">
      <p className="text-lg font-bold text-blue-700">새 제작물</p>
      <button
        onClick={onClick}
        className={`${TACTILE_BUTTON} w-full h-44 flex flex-col items-center justify-center gap-1 bg-blue-50 text-blue-700 text-lg`}
      >
        <span className="text-4xl leading-none">+</span>
        사진으로 등록하기
      </button>
    </div>
  );
}

// 데스크탑 행 — 지역본부·본사 화면과 동일한 표 레이아웃. 비고는 인라인으로
// 바로 고칠 수 있다.
function ItemRow({
  item,
  regionName,
  branchName,
  branchType,
  onPatch,
  onDelete,
  fullyLocked,
  actionLocked,
  onPickAction,
}: {
  item: Item;
  regionName: string;
  branchName: string;
  branchType: string;
  onPatch: (body: Record<string, unknown>) => Promise<void>;
  onDelete: () => void;
  fullyLocked: boolean;
  actionLocked: boolean;
  onPickAction: () => void;
}) {
  const needsAction = item.directiveCode?.requiresAction && !actionLocked;

  return (
    <tr className="border-b align-top">
      <td className="px-4 py-4 whitespace-nowrap border-r">{regionName}</td>
      <td className="px-4 py-4 whitespace-nowrap border-r">
        {branchName}
        <span className="text-gray-400"> ({branchType})</span>
      </td>
      <td className="px-4 py-4 border-r">
        <PhotoLightboxThumb path={item.photoPath} />
      </td>
      <td className="px-4 py-4 border-r">
        <NoteInput value={item.note} onPatch={onPatch} disabled={fullyLocked} className="min-w-[10rem]" />
      </td>
      <td className="px-4 py-4 border-r">
        <DirectiveDisplay directiveCode={item.directiveCode} directiveComment={item.directiveComment} />
      </td>
      <td className="px-4 py-4 border-r">
        {item.actionPhotoPath ? (
          <>
            <PhotoLightboxThumb path={item.actionPhotoPath} />
            {item.actionNote && <p className="text-sm text-gray-600 mt-1">{item.actionNote}</p>}
          </>
        ) : (
          <span className="text-gray-300">-</span>
        )}
        {needsAction && (
          <button
            onClick={onPickAction}
            className={`${TACTILE_BUTTON} mt-2 w-32 inline-block text-center bg-gray-900 text-white py-1.5 text-sm`}
          >
            {item.actionPhotoPath ? "다시 올리기" : "조치결과 올리기"}
          </button>
        )}
      </td>
      <td className="px-4 py-4 whitespace-nowrap border-r">
        <StateBadge item={item} />
      </td>
      <td className="px-4 py-4 whitespace-nowrap">
        {!fullyLocked && !item.directiveCode && (
          <button onClick={onDelete} className="text-sm text-red-600">
            삭제
          </button>
        )}
      </td>
    </tr>
  );
}

// 데스크탑 표 맨 아래에 항상 떠 있는 빈 행 — 사진 칸의 버튼을 누르면 등록이 시작된다.
function AddItemRow({
  regionName,
  branchName,
  branchType,
  onClick,
}: {
  regionName: string;
  branchName: string;
  branchType: string;
  onClick: () => void;
}) {
  return (
    <tr className="border-b align-top bg-blue-50/40">
      <td className="px-4 py-4 whitespace-nowrap border-r">{regionName}</td>
      <td className="px-4 py-4 whitespace-nowrap border-r">
        {branchName}
        <span className="text-gray-400"> ({branchType})</span>
      </td>
      <td className="px-4 py-4 border-r">
        <button
          onClick={onClick}
          className={`${TACTILE_BUTTON} w-28 h-28 flex flex-col items-center justify-center gap-1 bg-blue-600 text-white text-sm`}
        >
          <span className="text-3xl leading-none">+</span>
          등록
        </button>
      </td>
      <td className="px-4 py-4 border-r text-gray-300">-</td>
      <td className="px-4 py-4 border-r text-gray-300">-</td>
      <td className="px-4 py-4 border-r text-gray-300">-</td>
      <td className="px-4 py-4 border-r text-gray-300">-</td>
      <td className="px-4 py-4 text-gray-300">-</td>
    </tr>
  );
}

function PhotoThumb({ path }: { path: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={photoUrl(path, 1000)} alt="" className="w-full max-h-72 object-contain bg-gray-50 rounded" />;
}

function PhotoLightboxThumb({ path }: { path: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photoUrl(path, 600)}
      alt=""
      style={{ maxWidth: "none" }}
      className="w-36 h-36 object-contain bg-gray-50 rounded border"
    />
  );
}

function NewItemForm({
  branchId,
  onClose,
  onCreated,
}: {
  branchId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  async function submit() {
    if (files.length === 0) {
      alert("사진을 먼저 촬영하거나 갤러리에서 선택해주세요.");
      return;
    }
    setBusy(true);
    setProgress({ done: 0, total: files.length });
    try {
      for (let i = 0; i < files.length; i++) {
        const path = await compressAndUpload(files[i], branchId, "initial");
        const res = await fetch(`/api/branch/${branchId}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photoPath: path, note }),
        });
        if (!res.ok) throw new Error("등록에 실패했습니다. 다시 시도해주세요.");
        setProgress({ done: i + 1, total: files.length });
      }
      onCreated();
    } catch (e) {
      alert(e instanceof Error ? e.message : "등록에 실패했습니다.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end md:items-center md:justify-center z-20">
      <div className="bg-white w-full md:w-[460px] md:rounded-2xl rounded-t-2xl p-4 space-y-4 max-h-[85vh] overflow-y-auto">
        <h2 className="font-bold text-xl">새 제작물 등록</h2>

        <div>
          <p className="text-base font-medium mb-1">사진</p>
          <div className="flex gap-2">
            <label className="flex-1">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                className="hidden"
                onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              />
              <span
                className={`${TACTILE_BUTTON} inline-block w-full text-center bg-blue-600 text-white py-4 text-base`}
              >
                사진 촬영
              </span>
            </label>
            <label className="flex-1">
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              />
              <span
                className={`${TACTILE_BUTTON} inline-block w-full text-center bg-white border text-blue-700 py-4 text-base`}
              >
                갤러리에서 선택
              </span>
            </label>
          </div>
          {files.length > 0 && (
            <p className="text-sm text-gray-500 mt-1">{files.length}장 선택됨</p>
          )}
          {files.length > 1 && (
            <p className="text-sm text-gray-400 mt-1">
              선택한 {files.length}장 모두 같은 비고로 등록됩니다. 등록 후 각 사진마다 표에서 따로 고칠 수 있습니다.
            </p>
          )}
        </div>

        <div>
          <p className="text-base font-medium mb-1">비고 (선택)</p>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="추가 설명이 필요할 경우 남겨주세요"
            className="w-full border rounded-lg py-3 px-2 text-base"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className={`${TACTILE_BUTTON} flex-1 border bg-white py-3 text-base`}>
            취소
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className={`${TACTILE_BUTTON} flex-1 bg-blue-600 text-white py-3 text-base`}
          >
            {busy ? `등록 중... (${progress?.done ?? 0}/${progress?.total ?? files.length})` : "등록"}
          </button>
        </div>
      </div>
    </div>
  );
}

// 조치결과 사진 등록 — 새 제작물 등록과 동일한 모달 구조(파일 선택 즉시
// 업로드하지 않고, "등록" 버튼을 눌러야 실제로 업로드된다). 최초 등록 모달과
// 동일하게 비고 입력칸도 둔다(조치결과에 대한 추가 설명용 — 최초 제작물의
// 비고와는 별개 필드).
function ActionPhotoForm({
  branchId,
  itemId,
  onClose,
  onUploaded,
}: {
  branchId: string;
  itemId: string;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [actionNote, setActionNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!file) {
      alert("사진을 먼저 촬영하거나 갤러리에서 선택해주세요.");
      return;
    }
    setBusy(true);
    try {
      const path = await compressAndUpload(file, branchId, "action");
      const res = await fetch(`/api/branch/${branchId}/items/${itemId}/action-photo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoPath: path, actionNote }),
      });
      if (!res.ok) throw new Error("등록에 실패했습니다. 다시 시도해주세요.");
      onUploaded();
    } catch (e) {
      alert(e instanceof Error ? e.message : "등록에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end md:items-center md:justify-center z-20">
      <div className="bg-white w-full md:w-[460px] md:rounded-2xl rounded-t-2xl p-4 space-y-4 max-h-[85vh] overflow-y-auto">
        <h2 className="font-bold text-xl">조치결과 사진 등록</h2>

        <div>
          <p className="text-base font-medium mb-1">사진</p>
          <div className="flex gap-2">
            <label className="flex-1">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <span
                className={`${TACTILE_BUTTON} inline-block w-full text-center bg-blue-600 text-white py-4 text-base`}
              >
                사진 촬영
              </span>
            </label>
            <label className="flex-1">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <span
                className={`${TACTILE_BUTTON} inline-block w-full text-center bg-white border text-blue-700 py-4 text-base`}
              >
                갤러리에서 선택
              </span>
            </label>
          </div>
          {file && <p className="text-sm text-gray-500 mt-1">1장 선택됨</p>}
        </div>

        <div>
          <p className="text-base font-medium mb-1">비고 (선택)</p>
          <input
            value={actionNote}
            onChange={(e) => setActionNote(e.target.value)}
            placeholder="추가 설명이 필요할 경우 남겨주세요"
            className="w-full border rounded-lg py-3 px-2 text-base"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className={`${TACTILE_BUTTON} flex-1 border bg-white py-3 text-base`}>
            취소
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className={`${TACTILE_BUTTON} flex-1 bg-blue-600 text-white py-3 text-base`}
          >
            {busy ? "등록 중..." : "등록"}
          </button>
        </div>
      </div>
    </div>
  );
}
