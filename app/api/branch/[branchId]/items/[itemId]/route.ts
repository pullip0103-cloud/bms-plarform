import { NextRequest, NextResponse } from "next/server";
import { resolveBranchContext } from "@/lib/branchAuth";
import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";

// 지역본부 반려(REGION_REJECTED) 건을 지점이 사진/비고를 고쳐 다시 제출 -> SUBMITTED로 복귀
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ branchId: string; itemId: string }> }
) {
  const { branchId, itemId } = await params;
  const ctx = await resolveBranchContext(branchId);
  if (!ctx) {
    return NextResponse.json({ error: "INVALID_BRANCH_OR_NO_ACTIVE_ROUND" }, { status: 404 });
  }
  // 지역본부가 제출을 완료했거나 본사가 마감한 뒤에는 재제출을 받지 않는다.
  if (ctx.isRegionSubmitted || ctx.isRegionClosed) {
    return NextResponse.json({ error: "REGION_LOCKED" }, { status: 409 });
  }

  const itemRef = adminDb.collection("items").doc(itemId);
  const existing = await itemRef.get();
  if (!existing.exists || existing.data()!.branchId !== ctx.branchId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  if (existing.data()!.status !== "REGION_REJECTED") {
    return NextResponse.json({ error: "NOT_EDITABLE" }, { status: 409 });
  }

  const body = await req.json().catch(() => null);
  const photoPath = body?.photoPath as string | undefined;
  const note = body?.note as string | undefined;

  const update: Record<string, unknown> = {
    status: "SUBMITTED",
    regionRejectReason: null,
    updatedAt: Timestamp.now(),
  };
  if (photoPath) update.photoPath = photoPath;
  if (note !== undefined) update.note = note;

  await itemRef.update(update);

  await adminDb.collection("itemStatusLog").add({
    itemId,
    fromStatus: "REGION_REJECTED",
    toStatus: "SUBMITTED",
    actorRole: "branch",
    createdAt: Timestamp.now(),
  });

  const updated = await itemRef.get();
  return NextResponse.json({ item: { id: itemId, ...updated.data() } });
}
