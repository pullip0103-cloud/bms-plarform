import { NextRequest, NextResponse } from "next/server";
import { resolveRegion } from "@/lib/authz";
import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { isHqClosedForItem } from "@/lib/regionLock";

// 지역본부가 소속 지점 어떤 건이든 비고를 고친다. 지점의 "마감" 여부나
// 지역본부 자신의 "마감"(submissionRegionClosed) 여부와 무관하게, 본사가
// 그 지역본부의 제작물 전송을 마감(submissionHqClosed)하지 않았다면 항상
// 수정 가능하다 — 지점의 마감 토글은 건드리지 않는다. 단, 그 건이 현재
// 진행중인 라운드의 것이 아니면(과거 라운드 조회 화면) 잠금 상태와 무관하게
// 항상 거부한다 — 과거 라운드는 읽기전용이다.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ regionId: string; itemId: string }> }
) {
  const { regionId, itemId } = await params;
  const region = await resolveRegion(regionId);
  if (!region) {
    return NextResponse.json({ error: "INVALID_REGION" }, { status: 404 });
  }

  const itemRef = adminDb.collection("items").doc(itemId);
  const existing = await itemRef.get();
  if (!existing.exists || existing.data()!.regionId !== regionId) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  const activeRoundSnap = await adminDb.collection("rounds").where("status", "==", "진행중").limit(1).get();
  const activeRoundId = activeRoundSnap.empty ? null : activeRoundSnap.docs[0].id;
  if (!activeRoundId || existing.data()!.roundId !== activeRoundId) {
    return NextResponse.json({ error: "PAST_ROUND" }, { status: 409 });
  }
  if (await isHqClosedForItem(regionId, "submission")) {
    return NextResponse.json({ error: "REGION_CLOSED" }, { status: 409 });
  }

  const body = await req.json().catch(() => null);
  const update: Record<string, unknown> = {};

  if (body?.note !== undefined) {
    update.note = (body.note as string).trim() || null;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "NO_FIELDS" }, { status: 400 });
  }

  update.updatedAt = Timestamp.now();
  await itemRef.update(update);

  const updated = await itemRef.get();
  return NextResponse.json({ item: { id: itemId, ...updated.data() } });
}
