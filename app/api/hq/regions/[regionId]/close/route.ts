import { NextRequest, NextResponse } from "next/server";
import { requireHq } from "@/lib/authz";
import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { regionLockDocId } from "@/lib/regionLock";

// 본사가 특정 지역본부를 "마감"한다. 다시 누르면 해제(토글)된다.
// 마감되면 그 지역본부 소속 모든 쓰기(지점 등록/재제출/조치결과, 지역본부 승인/반려/수정)가 막힌다.
// 라운드 전체가 아니라 지역본부 단위로, 검토가 끝난 곳부터 순서대로 마감할 수 있다.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ regionId: string }> }
) {
  const { regionId } = await params;
  try {
    await requireHq();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 403 });
  }

  const roundSnap = await adminDb
    .collection("rounds")
    .where("status", "==", "진행중")
    .limit(1)
    .get();
  if (roundSnap.empty) {
    return NextResponse.json({ error: "NO_ACTIVE_ROUND" }, { status: 409 });
  }
  const roundId = roundSnap.docs[0].id;
  const docId = regionLockDocId(roundId, regionId);
  const docRef = adminDb.collection("roundRegionStatus").doc(docId);
  const snap = await docRef.get();

  const next = !(snap.data()?.isClosed === true);
  await docRef.set(
    {
      roundId,
      regionId,
      isClosed: next,
      closedAt: next ? Timestamp.now() : null,
    },
    { merge: true }
  );

  return NextResponse.json({ isClosed: next });
}
