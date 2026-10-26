import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";

export async function POST(req: NextRequest) {

  const body = await req.json().catch(() => null);
  const name = (body?.name as string | undefined)?.trim();
  if (!name) return NextResponse.json({ error: "NAME_REQUIRED" }, { status: 400 });

  // 새 라운드를 시작하면 기존 "진행중" 라운드는 자동 마감 처리한다
  // (지점 링크는 "현재 진행중인 라운드"를 기준으로 동작하므로, 동시에 두 라운드가
  // 진행중이면 지점 화면 데이터가 어느 라운드 것인지 모호해진다).
  const activeRounds = await adminDb.collection("rounds").where("status", "==", "진행중").get();
  const now = Timestamp.now();
  await Promise.all(
    activeRounds.docs.map((d) => d.ref.update({ status: "마감", closedAt: now }))
  );

  const docRef = await adminDb.collection("rounds").add({
    name,
    status: "진행중",
    createdAt: now,
  });

  const created = await docRef.get();
  return NextResponse.json({ round: { id: docRef.id, ...created.data() } });
}

export async function GET() {
  const snap = await adminDb.collection("rounds").orderBy("createdAt", "desc").get();
  const rounds = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return NextResponse.json({ rounds });
}
