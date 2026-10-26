import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { regionLockDocId, getRegionLockStatus } from "@/lib/regionLock";

// 본사가 특정 지역본부의 프로세스(제작물 전송/처리결과 입력/처리지침 배포,
// body.process)를 토글한다. 다시 누르면 해제된다. 제작물전송/처리결과
// 마감이 켜지면 그 프로세스에 대한 지역본부의 토글과 지점의 쓰기가 모두
// 막힌다. "처리 지침 배포"는 제작물 전송이 마감된 뒤에만 켤 수 있다 —
// 본사가 최종 항목 목록을 확정한 뒤에 지침을 공개한다는 순서를 강제한다.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ regionId: string }> }
) {
  const { regionId } = await params;
  const body = await req.json().catch(() => null);
  const process = body?.process as "submission" | "action" | "directive" | undefined;
  if (process !== "submission" && process !== "action" && process !== "directive") {
    return NextResponse.json({ error: "INVALID_PROCESS" }, { status: 400 });
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

  const field =
    process === "submission"
      ? "submissionHqClosed"
      : process === "action"
        ? "actionHqClosed"
        : "directivePublished";

  if (process === "directive") {
    const lock = await getRegionLockStatus(roundId, regionId);
    if (!lock.submissionHqClosed) {
      return NextResponse.json({ error: "SUBMISSION_NOT_CLOSED" }, { status: 409 });
    }
  }

  const docId = regionLockDocId(roundId, regionId);
  const docRef = adminDb.collection("roundRegionStatus").doc(docId);
  const snap = await docRef.get();

  const next = !(snap.data()?.[field] === true);
  await docRef.set(
    {
      roundId,
      regionId,
      [field]: next,
      [`${field}At`]: next ? Timestamp.now() : null,
    },
    { merge: true }
  );

  return NextResponse.json({ process, value: next });
}
