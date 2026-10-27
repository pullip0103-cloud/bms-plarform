import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

// 본사가 제작물을 삭제한다. 본사는 마감 상태와 무관하게 언제든 가능하다
// (처리지침 입력과 같은 원칙 — 본사의 조작은 프로세스 잠금으로 막지 않음).
// 단, 과거 라운드(진행중이 아닌 라운드)의 건은 읽기전용이므로 삭제할 수 없다.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await params;

  const itemRef = adminDb.collection("items").doc(itemId);
  const existing = await itemRef.get();
  if (!existing.exists) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const roundId = existing.data()!.roundId as string;
  const roundSnap = await adminDb.collection("rounds").doc(roundId).get();
  if (!roundSnap.exists || roundSnap.data()!.status !== "진행중") {
    return NextResponse.json({ error: "PAST_ROUND" }, { status: 409 });
  }

  await itemRef.delete();
  return NextResponse.json({ ok: true });
}
