import { NextRequest, NextResponse } from "next/server";
import { resolveBranchContext } from "@/lib/branchAuth";
import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { branchLockDocId, type LockProcess } from "@/lib/branchLock";

// 지점이 "마감" 버튼을 누른다(제작물 전송 또는 처리결과 입력, body.process로
// 구분). 다시 누르면(= "수정" 버튼) 해제된다 — 지역본부/본사가 아직 그
// 프로세스를 잠그지 않았다면 지점이 스스로 자유롭게 토글 가능.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ branchId: string }> }
) {
  const { branchId } = await params;
  const body = await req.json().catch(() => null);
  const process = body?.process as LockProcess | undefined;
  if (process !== "submission" && process !== "action") {
    return NextResponse.json({ error: "INVALID_PROCESS" }, { status: 400 });
  }

  const ctx = await resolveBranchContext(branchId);
  if (!ctx) {
    return NextResponse.json({ error: "INVALID_BRANCH_OR_NO_ACTIVE_ROUND" }, { status: 404 });
  }
  const locked =
    process === "submission"
      ? ctx.submissionRegionClosed || ctx.submissionHqClosed
      : ctx.actionRegionClosed || ctx.actionHqClosed;
  if (locked) {
    return NextResponse.json({ error: "REGION_LOCKED" }, { status: 409 });
  }

  const field = process === "submission" ? "submissionCompleted" : "actionCompleted";
  const docId = branchLockDocId(ctx.roundId, branchId);
  const docRef = adminDb.collection("roundBranchStatus").doc(docId);
  const snap = await docRef.get();

  const next = !(snap.data()?.[field] === true);
  const now = Timestamp.now();
  await docRef.set(
    {
      roundId: ctx.roundId,
      branchId,
      regionId: ctx.regionId,
      [field]: next,
      [`${field}At`]: next ? now : null,
    },
    { merge: true }
  );

  return NextResponse.json({ process, completed: next });
}
