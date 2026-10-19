import { NextRequest, NextResponse } from "next/server";
import { resolveBranchContext } from "@/lib/branchAuth";
import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";

// 지점이 조치결과 사진을 제출한다.
// 허용 상태: DIRECTIVE_ISSUED(최초 조치) / HQ_REJECTED(본사 반려 후 재조치) -> ACTION_SUBMITTED
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ branchId: string; itemId: string }> }
) {
  const { branchId, itemId } = await params;
  const ctx = await resolveBranchContext(branchId);
  if (!ctx) {
    return NextResponse.json({ error: "INVALID_BRANCH_OR_NO_ACTIVE_ROUND" }, { status: 404 });
  }
  // 조치결과 사진 올리기는 지역본부 "제출" 잠금의 예외다 — 지침부여->조치->
  // 재제출 흐름은 지역본부 제출 여부와 무관하게 계속돼야 한다. 본사가
  // 그 지역본부를 "마감"한 뒤에만 완전히 막는다.
  if (ctx.isRegionClosed) {
    return NextResponse.json({ error: "REGION_CLOSED" }, { status: 409 });
  }

  const body = await req.json().catch(() => null);
  const photoPath = body?.photoPath as string | undefined;
  if (!photoPath) {
    return NextResponse.json({ error: "MISSING_PHOTO" }, { status: 400 });
  }

  const itemRef = adminDb.collection("items").doc(itemId);
  const existing = await itemRef.get();
  if (!existing.exists || existing.data()!.branchId !== ctx.branchId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  const currentStatus = existing.data()!.status;
  if (currentStatus !== "DIRECTIVE_ISSUED" && currentStatus !== "HQ_REJECTED") {
    return NextResponse.json({ error: "NOT_EDITABLE" }, { status: 409 });
  }

  const now = Timestamp.now();
  await itemRef.update({
    actionPhotoPath: photoPath,
    status: "ACTION_SUBMITTED",
    actionSubmittedAt: now,
    hqRejectReason: null,
    updatedAt: now,
  });

  await adminDb.collection("itemStatusLog").add({
    itemId,
    fromStatus: currentStatus,
    toStatus: "ACTION_SUBMITTED",
    actorRole: "branch",
    createdAt: now,
  });

  const updated = await itemRef.get();
  return NextResponse.json({ item: { id: itemId, ...updated.data() } });
}
