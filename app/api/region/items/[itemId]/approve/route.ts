import { NextRequest, NextResponse } from "next/server";
import { requireRegion } from "@/lib/authz";
import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { isRegionClosedForItem } from "@/lib/regionLock";

// 지역본부 1차 확인: SUBMITTED -> REGION_APPROVED
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await params;
  let profile;
  try {
    profile = await requireRegion();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 403 });
  }

  // 본사가 이 지역본부를 마감한 뒤에는 지역본부도 아무것도 바꿀 수 없다.
  if (await isRegionClosedForItem(profile.regionId!)) {
    return NextResponse.json({ error: "REGION_CLOSED" }, { status: 409 });
  }

  const itemRef = adminDb.collection("items").doc(itemId);
  const snap = await itemRef.get();
  if (!snap.exists || snap.data()!.regionId !== profile.regionId || snap.data()!.status !== "SUBMITTED") {
    return NextResponse.json({ error: "UPDATE_FAILED" }, { status: 409 });
  }

  const now = Timestamp.now();
  await itemRef.update({ status: "REGION_APPROVED", regionDecidedAt: now, updatedAt: now });

  await adminDb.collection("itemStatusLog").add({
    itemId,
    fromStatus: "SUBMITTED",
    toStatus: "REGION_APPROVED",
    actorRole: "region",
    createdAt: now,
  });

  const updated = await itemRef.get();
  return NextResponse.json({ item: { id: itemId, ...updated.data() } });
}
