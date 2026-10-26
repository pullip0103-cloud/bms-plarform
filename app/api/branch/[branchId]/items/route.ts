import { NextRequest, NextResponse } from "next/server";
import { resolveBranchContext } from "@/lib/branchAuth";
import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";

// 지점이 새 제작물 건을 등록한다. 사진은 upload-url로 이미 Cloudinary에 올라간 뒤,
// 그 public_id(photoPath)만 넘겨받아 문서를 생성한다.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ branchId: string }> }
) {
  const { branchId } = await params;
  const ctx = await resolveBranchContext(branchId);
  if (!ctx) {
    return NextResponse.json({ error: "INVALID_BRANCH_OR_NO_ACTIVE_ROUND" }, { status: 404 });
  }
  // 지역본부가 "제작물 전송" 프로세스를 마감했거나 본사가 마감한 뒤에는
  // 신규 등록을 받지 않는다. 지점 스스로 "마감"을 눌렀을 때도 같은 이유로
  // 막되, 이건 "수정" 버튼으로 언제든 스스로 풀 수 있는 소프트 잠금이다
  // (조치결과 사진 올리기는 별도 라우트이며 이 잠금의 영향을 받지 않는다).
  if (ctx.submissionRegionClosed || ctx.submissionHqClosed || ctx.submissionCompleted) {
    return NextResponse.json({ error: "REGION_LOCKED" }, { status: 409 });
  }

  const body = await req.json().catch(() => null);
  const photoPath = body?.photoPath as string | undefined;
  const note = (body?.note as string | undefined) ?? null;

  if (!photoPath) {
    return NextResponse.json({ error: "MISSING_PHOTO" }, { status: 400 });
  }

  const now = Timestamp.now();
  const docRef = await adminDb.collection("items").add({
    roundId: ctx.roundId,
    branchId: ctx.branchId,
    regionId: ctx.regionId,
    photoPath,
    note,
    directiveCodeId: null,
    actionPhotoPath: null,
    actionNote: null,
    createdAt: now,
    updatedAt: now,
  });

  const created = await docRef.get();
  return NextResponse.json({ item: { id: docRef.id, ...created.data() } });
}
