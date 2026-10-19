import { NextResponse } from "next/server";
import { requireRegion } from "@/lib/authz";
import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { regionLockDocId } from "@/lib/regionLock";

// 지역본부가 "제출" 버튼을 누른다. 다시 누르면 해제(토글)된다.
// 제출 상태가 되면 소속 지점은 신규 등록/재제출을 할 수 없다(조치결과 사진은 예외).
export async function POST() {
  let profile;
  try {
    profile = await requireRegion();
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
  const docId = regionLockDocId(roundId, profile.regionId!);
  const docRef = adminDb.collection("roundRegionStatus").doc(docId);
  const snap = await docRef.get();

  if (snap.data()?.isClosed) {
    return NextResponse.json({ error: "REGION_CLOSED" }, { status: 409 });
  }

  const next = !(snap.data()?.isSubmitted === true);
  await docRef.set(
    {
      roundId,
      regionId: profile.regionId,
      isSubmitted: next,
      submittedAt: next ? Timestamp.now() : null,
    },
    { merge: true }
  );

  return NextResponse.json({ isSubmitted: next });
}
