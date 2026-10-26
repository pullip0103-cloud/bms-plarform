import { NextRequest, NextResponse } from "next/server";
import { resolveBranchContext } from "@/lib/branchAuth";
import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";

// 지점이 조치결과 사진을 올린다(최초 제출/재촬영 모두 같은 라우트 — 승인/
// 반려 단계가 없으므로 언제든 다시 찍어 덮어쓸 수 있다). 조건: 그 항목에
// 배포된(directivePublished) 조치필요(requiresAction) 지침이 있어야 하고,
// 처리결과 입력 프로세스가 지역본부/본사에 의해 마감되지 않았어야 한다.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ branchId: string; itemId: string }> }
) {
  const { branchId, itemId } = await params;
  const ctx = await resolveBranchContext(branchId);
  if (!ctx) {
    return NextResponse.json({ error: "INVALID_BRANCH_OR_NO_ACTIVE_ROUND" }, { status: 404 });
  }
  if (ctx.actionRegionClosed || ctx.actionHqClosed) {
    return NextResponse.json({ error: "ACTION_LOCKED" }, { status: 409 });
  }

  const body = await req.json().catch(() => null);
  const photoPath = body?.photoPath as string | undefined;
  const actionNote = (body?.actionNote as string | undefined)?.trim() || null;
  if (!photoPath) {
    return NextResponse.json({ error: "MISSING_PHOTO" }, { status: 400 });
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

  const directiveCodeId = existing.data()!.directiveCodeId as string | undefined;
  if (!directiveCodeId) {
    return NextResponse.json({ error: "NO_DIRECTIVE" }, { status: 409 });
  }
  const lock = await adminDb
    .collection("roundRegionStatus")
    .doc(`${ctx.roundId}_${ctx.regionId}`)
    .get();
  if (!lock.data()?.directivePublished) {
    return NextResponse.json({ error: "DIRECTIVE_NOT_PUBLISHED" }, { status: 409 });
  }
  const codeSnap = await adminDb.collection("directiveCodes").doc(directiveCodeId).get();
  if (!codeSnap.exists || !codeSnap.data()!.requiresAction) {
    return NextResponse.json({ error: "NO_ACTION_REQUIRED" }, { status: 409 });
  }

  const now = Timestamp.now();
  await itemRef.update({
    actionPhotoPath: photoPath,
    actionNote,
    actionSubmittedAt: now,
    updatedAt: now,
  });

  const updated = await itemRef.get();
  return NextResponse.json({ item: { id: itemId, ...updated.data() } });
}
