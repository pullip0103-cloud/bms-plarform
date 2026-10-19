import { NextRequest, NextResponse } from "next/server";
import { resolveBranchContext } from "@/lib/branchAuth";
import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { ITEM_TYPES } from "@/lib/constants";

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
  // 지역본부가 제출을 완료했거나 본사가 마감한 뒤에는 신규 등록을 받지 않는다.
  // (조치결과 사진 올리기는 별도 라우트이며 이 잠금의 예외다.)
  if (ctx.isRegionSubmitted || ctx.isRegionClosed) {
    return NextResponse.json({ error: "REGION_LOCKED" }, { status: 409 });
  }

  const body = await req.json().catch(() => null);
  const itemType = body?.itemType as string | undefined;
  const photoPath = body?.photoPath as string | undefined;
  const note = (body?.note as string | undefined) ?? null;

  if (!itemType || !ITEM_TYPES.includes(itemType as (typeof ITEM_TYPES)[number])) {
    return NextResponse.json({ error: "INVALID_ITEM_TYPE" }, { status: 400 });
  }
  if (!photoPath) {
    return NextResponse.json({ error: "MISSING_PHOTO" }, { status: 400 });
  }

  const now = Timestamp.now();
  const docRef = await adminDb.collection("items").add({
    roundId: ctx.roundId,
    branchId: ctx.branchId,
    regionId: ctx.regionId,
    itemType,
    photoPath,
    note,
    status: "SUBMITTED",
    directiveCodeId: null,
    regionRejectReason: null,
    actionPhotoPath: null,
    hqRejectReason: null,
    createdAt: now,
    updatedAt: now,
  });

  await adminDb.collection("itemStatusLog").add({
    itemId: docRef.id,
    fromStatus: null,
    toStatus: "SUBMITTED",
    actorRole: "branch",
    createdAt: now,
  });

  const created = await docRef.get();
  return NextResponse.json({ item: { id: docRef.id, ...created.data() } });
}
