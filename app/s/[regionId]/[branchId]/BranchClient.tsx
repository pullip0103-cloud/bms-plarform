"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { compressAndUpload } from "@/lib/uploadPhoto";
import { photoUrl } from "@/lib/photoUrl";
import { ITEM_TYPES, STATUS_LABEL, STATUS_BADGE_COLOR, type ItemStatus } from "@/lib/constants";

type Item = {
  id: string;
  itemType: string;
  note: string | null;
  status: ItemStatus;
  photoPath: string;
  actionPhotoPath: string | null;
  regionRejectReason: string | null;
  hqRejectReason: string | null;
  directiveCode: { label: string; description: string | null; requiresAction: boolean } | null;
};

type Ctx = {
  branchId: string;
  branchName: string;
  branchType: string;
  regionName: string;
  roundName: string;
  isRegionSubmitted: boolean;
  isRegionClosed: boolean;
};

export default function BranchClient({
  regionId,
  branchId,
}: {
  regionId: string;
  branchId: string;
}) {
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/branch/${branchId}/context`);
    if (!res.ok) {
      setError("지점 정보를 불러오지 못했거나 현재 진행중인 라운드가 없습니다. 담당자에게 확인해주세요.");
      setLoading(false);
      return;
    }
    const data = await res.json();
    setCtx(data.context);
    setItems(data.items);
    setLoading(false);
  }, [branchId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 지점 데이터는 매번 서버에서 새로 불러와야 함
    void load();
  }, [load]);

  if (loading) return <Centered>불러오는 중...</Centered>;
  if (error) return <Centered>{error}</Centered>;
  if (!ctx) return null;

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <header className="bg-white border-b px-4 py-4 sticky top-0 z-10">
        <Link href={`/s/${regionId}`} className="text-sm text-blue-600">
          ← 다른 지점/대리점 선택
        </Link>
        <p className="text-sm text-gray-500 mt-1">
          {ctx.regionName} · {ctx.branchType}
        </p>
        <h1 className="text-lg font-bold">{ctx.branchName}</h1>
        <p className="text-sm text-gray-500">{ctx.roundName} 전수조사</p>
      </header>

      <main className="px-4 py-4 space-y-3">
        {ctx.isRegionClosed ? (
          <p className="text-sm text-gray-600 bg-gray-100 border rounded-lg p-3">
            본사가 이번 라운드를 마감했습니다. 더 이상 등록/수정이 불가합니다.
          </p>
        ) : ctx.isRegionSubmitted ? (
          <p className="text-sm text-gray-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
            지역본부에서 제출을 완료했습니다. 새 제작물은 추가할 수 없지만, 조치결과 사진은 계속 올릴 수 있습니다.
          </p>
        ) : (
          <p className="text-sm text-gray-600">
            매장 내 제작물 사진을 아래에 모두 등록해주세요.
          </p>
        )}

        {items.length === 0 && (
          <p className="text-center text-gray-400 py-10">
            아직 등록한 제작물이 없습니다.
          </p>
        )}

        {items.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            branchId={branchId}
            onChanged={load}
            locked={ctx.isRegionSubmitted || ctx.isRegionClosed}
            fullyLocked={ctx.isRegionClosed}
          />
        ))}
      </main>

      {!ctx.isRegionSubmitted && !ctx.isRegionClosed && (
        <div className="fixed bottom-0 inset-x-0 bg-white border-t p-4">
          <button
            onClick={() => setShowForm(true)}
            className="w-full bg-blue-600 text-white rounded-lg py-3 font-bold text-base"
          >
            + 새 제작물 추가
          </button>
        </div>
      )}

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
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6 text-center text-gray-600">
      {children}
    </div>
  );
}

function ItemCard({
  item,
  branchId,
  onChanged,
  locked,
  fullyLocked,
}: {
  item: Item;
  branchId: string;
  onChanged: () => void;
  locked: boolean;
  fullyLocked: boolean;
}) {
  const [busy, setBusy] = useState(false);

  // 지역본부 제출/본사 마감 시: 반려 재제출(신규 등록과 같은 성격)은 막지만,
  // 조치결과 사진 올리기는 본사 마감 전까지는 계속 허용한다.
  const needsResubmit = item.status === "REGION_REJECTED" && !locked;
  const needsAction =
    (item.status === "DIRECTIVE_ISSUED" || item.status === "HQ_REJECTED") && !fullyLocked;

  async function handleResubmit(file: File) {
    setBusy(true);
    try {
      const path = await compressAndUpload(file, branchId, "initial");
      await fetch(`/api/branch/${branchId}/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoPath: path }),
      });
      onChanged();
    } catch (e) {
      alert(e instanceof Error ? e.message : "다시 올리기에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function handleActionPhoto(file: File) {
    setBusy(true);
    try {
      const path = await compressAndUpload(file, branchId, "action");
      await fetch(`/api/branch/${branchId}/items/${item.id}/action-photo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoPath: path }),
      });
      onChanged();
    } catch (e) {
      alert(e instanceof Error ? e.message : "조치결과 사진 업로드에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white rounded-lg border p-3 space-y-2">
      <div className="flex justify-between items-start">
        <span className="font-semibold">{item.itemType}</span>
        <span className={`text-xs px-2 py-1 rounded ${STATUS_BADGE_COLOR[item.status]}`}>
          {STATUS_LABEL[item.status]}
        </span>
      </div>

      <PhotoThumb path={item.photoPath} />

      <p className="text-sm text-gray-500">비고: {item.note || "-"}</p>

      {item.directiveCode && (
        <p className="text-sm font-medium text-orange-700">
          처리 지침: {item.directiveCode.label}
          {item.directiveCode.description ? ` (${item.directiveCode.description})` : ""}
        </p>
      )}

      {item.regionRejectReason && (
        <p className="text-sm text-red-600">반려 사유: {item.regionRejectReason}</p>
      )}
      {item.hqRejectReason && (
        <p className="text-sm text-red-600">반려 사유: {item.hqRejectReason}</p>
      )}

      {item.actionPhotoPath && (
        <div>
          <p className="text-xs text-gray-500 mb-1">조치결과 사진</p>
          <PhotoThumb path={item.actionPhotoPath} />
        </div>
      )}

      {needsResubmit && (
        <PhotoPickButton label="다시 올리기" busy={busy} onPick={handleResubmit} />
      )}
      {needsAction && (
        <PhotoPickButton label="조치결과 사진 올리기" busy={busy} onPick={handleActionPhoto} />
      )}
    </div>
  );
}

function PhotoThumb({ path }: { path: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={photoUrl(path, 800)} alt="" className="w-full max-h-48 object-cover rounded" />;
}

function PhotoPickButton({
  label,
  busy,
  onPick,
}: {
  label: string;
  busy: boolean;
  onPick: (file: File) => void;
}) {
  return (
    <label className="block">
      <input
        type="file"
        accept="image/*"
        className="hidden"
        disabled={busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onPick(file);
          e.target.value = "";
        }}
      />
      <span className="inline-block w-full text-center bg-gray-900 text-white rounded-lg py-2 font-medium">
        {busy ? "업로드 중..." : label}
      </span>
    </label>
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
  const [file, setFile] = useState<File | null>(null);
  const [itemType, setItemType] = useState<string>(ITEM_TYPES[0]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!file) {
      alert("사진을 먼저 촬영/첨부해주세요.");
      return;
    }
    setBusy(true);
    try {
      const path = await compressAndUpload(file, branchId, "initial");
      const res = await fetch(`/api/branch/${branchId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemType, photoPath: path, note }),
      });
      if (!res.ok) throw new Error("등록에 실패했습니다. 다시 시도해주세요.");
      onCreated();
    } catch (e) {
      alert(e instanceof Error ? e.message : "등록에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end z-20">
      <div className="bg-white w-full rounded-t-2xl p-4 space-y-4 max-h-[85vh] overflow-y-auto">
        <h2 className="font-bold text-lg">새 제작물 등록</h2>

        <div>
          <p className="text-sm font-medium mb-1">사진</p>
          <label className="block">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <span className="inline-block w-full text-center bg-gray-100 border rounded-lg py-3">
              {file ? "사진 선택됨 (다시 선택)" : "사진 촬영/첨부"}
            </span>
          </label>
        </div>

        <div>
          <p className="text-sm font-medium mb-1">제작물 종류</p>
          <select
            value={itemType}
            onChange={(e) => setItemType(e.target.value)}
            className="w-full border rounded-lg py-3 px-2"
          >
            {ITEM_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div>
          <p className="text-sm font-medium mb-1">비고 (선택)</p>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="예: 입구 좌측"
            className="w-full border rounded-lg py-3 px-2"
          />
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 border rounded-lg py-3">
            취소
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="flex-1 bg-blue-600 text-white rounded-lg py-3 font-bold"
          >
            {busy ? "등록 중..." : "등록"}
          </button>
        </div>
      </div>
    </div>
  );
}
