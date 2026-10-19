import { NextRequest, NextResponse } from "next/server";
import { requireHq } from "@/lib/authz";
import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { isRegionClosedForItem } from "@/lib/regionLock";

// 본사 조치결과 반려: ACTION_SUBMITTED -> HQ_REJECTED (지점이 재조치)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await params;
  try {
    await requireHq();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const reason = (body?.reason as string | undefined)?.trim();
  if (!reason) {
    return NextResponse.json({ error: "REASON_REQUIRED" }, { status: 400 });
  }

  const itemRef = adminDb.collection("items").doc(itemId);
  const snap = await itemRef.get();
  if (!snap.exists || snap.data()!.status !== "ACTION_SUBMITTED") {
    return NextResponse.json({ error: "UPDATE_FAILED" }, { status: 409 });
  }
  if (await isRegionClosedForItem(snap.data()!.regionId)) {
    return NextResponse.json({ error: "REGION_CLOSED" }, { status: 409 });
  }

  const now = Timestamp.now();
  await itemRef.update({
    status: "HQ_REJECTED",
    hqRejectReason: reason,
    hqDecidedAt: now,
    updatedAt: now,
  });

  await adminDb.collection("itemStatusLog").add({
    itemId,
    fromStatus: "ACTION_SUBMITTED",
    toStatus: "HQ_REJECTED",
    actorRole: "hq",
    note: reason,
    createdAt: now,
  });

  const updated = await itemRef.get();
  return NextResponse.json({ item: { id: itemId, ...updated.data() } });
}
