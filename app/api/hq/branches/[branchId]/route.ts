import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

// 지점/대리점 구분 보정(PPT 추출 시 접미사가 생략되어 needsTypeReview=true로 들어온 건)
// 및 활성화/비활성화 토글.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ branchId: string }> }
) {
  const { branchId } = await params;

  const body = await req.json().catch(() => null);
  const update: Record<string, unknown> = {};
  if (body?.branchType === "지점" || body?.branchType === "대리점") {
    update.branchType = body.branchType;
    update.needsTypeReview = false;
  }
  if (typeof body?.isActive === "boolean") {
    update.isActive = body.isActive;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "NO_VALID_FIELDS" }, { status: 400 });
  }

  await adminDb.collection("branches").doc(branchId).update(update);
  const updated = await adminDb.collection("branches").doc(branchId).get();
  return NextResponse.json({ branch: { id: branchId, ...updated.data() } });
}
