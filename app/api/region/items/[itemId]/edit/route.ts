import { NextRequest, NextResponse } from "next/server";
import { requireRegion } from "@/lib/authz";
import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { isRegionClosedForItem } from "@/lib/regionLock";
import { ITEM_TYPES } from "@/lib/constants";

/**
 * 지역본부가 소속 지점이 올린 건의 일부 항목(제작물 종류/비고)을 직접
 * 고칠 수 있다 — 예: 지점이 분류를 잘못 고른 경우 지역본부가 바로 정정.
 * 사진 자체는 지점만 바꿀 수 있으므로 이 라우트는 다루지 않는다.
 * 상태값과 무관하게 가능하지만, 본사가 그 지역본부를 마감한 뒤에는 막힌다.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await params;
  let profile;
  try {
    profile = await requireRegion();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 403 });
  }

  if (await isRegionClosedForItem(profile.regionId!)) {
    return NextResponse.json({ error: "REGION_CLOSED" }, { status: 409 });
  }

  const itemRef = adminDb.collection("items").doc(itemId);
  const snap = await itemRef.get();
  if (!snap.exists || snap.data()!.regionId !== profile.regionId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const update: Record<string, unknown> = {};
  if (body?.itemType && ITEM_TYPES.includes(body.itemType)) {
    update.itemType = body.itemType;
  }
  if (typeof body?.note === "string") {
    update.note = body.note;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "NO_VALID_FIELDS" }, { status: 400 });
  }
  update.updatedAt = Timestamp.now();

  await itemRef.update(update);

  await adminDb.collection("itemStatusLog").add({
    itemId,
    fromStatus: snap.data()!.status,
    toStatus: snap.data()!.status,
    actorRole: "region",
    note: "지역본부 직접 수정",
    createdAt: Timestamp.now(),
  });

  const updated = await itemRef.get();
  return NextResponse.json({ item: { id: itemId, ...updated.data() } });
}
