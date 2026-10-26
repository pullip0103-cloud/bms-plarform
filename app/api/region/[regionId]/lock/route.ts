import { NextRequest, NextResponse } from "next/server";
import { resolveRegion } from "@/lib/authz";
import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { regionLockDocId } from "@/lib/regionLock";
import { getCompletedBranchIds, type LockProcess } from "@/lib/branchLock";

/**
 * 지역본부가 특정 프로세스(제작물 전송/처리결과 입력, body.process)를
 * "마감"한다. 소속 활성 지점이 하나라도 그 프로세스를 "마감"하지 않았으면
 * 켤 수 없다(409). 다시 누르면(마감 해제) 지점이 다시 등록/수정할 수 있게
 * 된다 — 해제는 전원완료 여부와 무관하게 항상 가능하다. 본사가 해당
 * 프로세스를 이미 마감했다면(submissionHqClosed/actionHqClosed) 지역본부는
 * 어느 쪽으로도 토글할 수 없다.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ regionId: string }> }
) {
  const { regionId } = await params;
  const body = await req.json().catch(() => null);
  const process = body?.process as LockProcess | undefined;
  if (process !== "submission" && process !== "action") {
    return NextResponse.json({ error: "INVALID_PROCESS" }, { status: 400 });
  }

  const region = await resolveRegion(regionId);
  if (!region) return NextResponse.json({ error: "INVALID_REGION" }, { status: 404 });

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
  const lockSnap = await docRef.get();

  const regionField = process === "submission" ? "submissionRegionClosed" : "actionRegionClosed";
  const hqField = process === "submission" ? "submissionHqClosed" : "actionHqClosed";

  if (lockSnap.data()?.[hqField]) {
    return NextResponse.json({ error: "REGION_CLOSED" }, { status: 409 });
  }

  const next = !(lockSnap.data()?.[regionField] === true);

  if (next) {
    const branchesSnap = await adminDb
      .collection("branches")
      .where("regionId", "==", regionId)
      .where("isActive", "==", true)
      .get();
    const completedIds = await getCompletedBranchIds(roundId, process);
    const incomplete = branchesSnap.docs.filter((d) => !completedIds.has(d.id));
    if (incomplete.length > 0) {
      return NextResponse.json(
        {
          error: "BRANCHES_NOT_COMPLETE",
          incompleteCount: incomplete.length,
          totalCount: branchesSnap.docs.length,
        },
        { status: 409 }
      );
    }
  }

  const now = Timestamp.now();
  await docRef.set(
    {
      roundId,
      regionId,
      [regionField]: next,
      [`${regionField}At`]: next ? now : null,
    },
    { merge: true }
  );

  return NextResponse.json({ process, closed: next });
}
