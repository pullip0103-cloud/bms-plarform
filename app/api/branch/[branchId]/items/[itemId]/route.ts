import { NextRequest, NextResponse } from "next/server";
import { resolveBranchContext } from "@/lib/branchAuth";
import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { getRegionLockStatus } from "@/lib/regionLock";

// 지점이 이미 등록한 제작물의 비고를 고친다. 사진은 한꺼번에 갤러리에서
// 올리고 비고는 필요한 건만 나중에 따로 채우는 사용 흐름을 지원하기 위함.
// 신규 등록과 같은 잠금 규칙을 쓴다 — 지역본부가 제작물 전송을 마감했거나
// 본사가 마감한 뒤에는 더 이상 고칠 수 없다.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ branchId: string; itemId: string }> }
) {
  const { branchId, itemId } = await params;
  const ctx = await resolveBranchContext(branchId);
  if (!ctx) {
    return NextResponse.json({ error: "INVALID_BRANCH_OR_NO_ACTIVE_ROUND" }, { status: 404 });
  }
  if (ctx.submissionRegionClosed || ctx.submissionHqClosed || ctx.submissionCompleted) {
    return NextResponse.json({ error: "REGION_LOCKED" }, { status: 409 });
  }

  const body = await req.json().catch(() => null);
  const update: Record<string, unknown> = {};

  if (body?.note !== undefined) {
    update.note = (body.note as string).trim() || null;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "NO_FIELDS" }, { status: 400 });
  }

  const itemRef = adminDb.collection("items").doc(itemId);
  const existing = await itemRef.get();
  if (
    !existing.exists ||
    existing.data()!.branchId !== ctx.branchId ||
    existing.data()!.roundId !== ctx.roundId
  ) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  update.updatedAt = Timestamp.now();
  await itemRef.update(update);

  const updated = await itemRef.get();
  return NextResponse.json({ item: { id: itemId, ...updated.data() } });
}

// 지점이 이미 등록한 제작물을 삭제한다. 수정(PATCH)과 같은 잠금 규칙을
// 쓴다 — 지역본부/본사가 제작물 전송을 마감한 뒤에는 지울 수 없다. 또한
// 조치 지침이 "배포"되어 화면에 조치대기/조치완료로 보이는 건은 삭제할
// 수 없다 — 지점이 조치결과 처리 흔적을 지워버리면 본사/지역본부가
// 추적할 수 없게 되므로, 지침이 배포되기 전까지만 자유롭게 지울 수 있고
// 배포된 뒤에는 조치결과 사진 재업로드로만 바꿀 수 있다(2026-10-27).
// 아직 배포 전(초안)인 지침이 내부적으로 배정돼 있을 뿐이라면 지점 화면에
// 전혀 안 보이므로(directiveCode: null로 내려감) 이 단계에서는 삭제도
// 똑같이 허용해야 화면과 서버 판단이 일치한다 — getRegionLockStatus의
// directivePublished로 그 일치를 재확인한다.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ branchId: string; itemId: string }> }
) {
  const { branchId, itemId } = await params;
  const ctx = await resolveBranchContext(branchId);
  if (!ctx) {
    return NextResponse.json({ error: "INVALID_BRANCH_OR_NO_ACTIVE_ROUND" }, { status: 404 });
  }
  if (ctx.submissionRegionClosed || ctx.submissionHqClosed || ctx.submissionCompleted) {
    return NextResponse.json({ error: "REGION_LOCKED" }, { status: 409 });
  }

  const itemRef = adminDb.collection("items").doc(itemId);
  const existing = await itemRef.get();
  if (
    !existing.exists ||
    existing.data()!.branchId !== ctx.branchId ||
    existing.data()!.roundId !== ctx.roundId
  ) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  if (existing.data()!.directiveCodeId) {
    const lock = await getRegionLockStatus(ctx.roundId, ctx.regionId);
    if (lock.directivePublished) {
      return NextResponse.json({ error: "DIRECTIVE_ASSIGNED" }, { status: 409 });
    }
  }

  await itemRef.delete();
  return NextResponse.json({ ok: true });
}
