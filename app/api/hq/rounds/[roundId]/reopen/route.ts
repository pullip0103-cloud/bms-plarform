import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";

// 마감된 라운드를 다시 "진행중"으로 되돌린다(실수로 새 라운드를 시작했거나
// 마감한 경우 복구용). 현재 "진행중"인 다른 라운드가 있으면 함께 "마감"
// 처리한다 — 동시에 두 라운드가 진행중이면 지점 링크(/s)가 어느 라운드
// 기준인지 모호해지기 때문(createRound와 동일한 제약).
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ roundId: string }> }
) {
  const { roundId } = await params;

  const roundRef = adminDb.collection("rounds").doc(roundId);
  const snap = await roundRef.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "ROUND_NOT_FOUND" }, { status: 404 });
  }

  const now = Timestamp.now();
  const otherActive = await adminDb
    .collection("rounds")
    .where("status", "==", "진행중")
    .get();
  await Promise.all(
    otherActive.docs
      .filter((d) => d.id !== roundId)
      .map((d) => d.ref.update({ status: "마감", closedAt: now }))
  );

  await roundRef.update({ status: "진행중", closedAt: null });

  const updated = await roundRef.get();
  return NextResponse.json({ round: { id: roundId, ...updated.data() } });
}
