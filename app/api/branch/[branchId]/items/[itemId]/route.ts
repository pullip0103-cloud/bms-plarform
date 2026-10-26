import { NextRequest, NextResponse } from "next/server";
import { resolveBranchContext } from "@/lib/branchAuth";
import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";

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
