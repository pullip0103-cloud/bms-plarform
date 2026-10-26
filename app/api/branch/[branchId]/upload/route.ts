import { NextRequest, NextResponse } from "next/server";
import { resolveBranchContext } from "@/lib/branchAuth";
import { uploadImageBuffer } from "@/lib/cloudinary";

/**
 * 지점이 압축된 사진을 올리면, 서버(Next.js)가 대신 Cloudinary로 업로드한다.
 * (왜 서버를 거치는지는 lib/cloudinary.ts의 주석 참고 — 회사망의 TLS
 * revocation-check가 브라우저의 Cloudinary 직접 연결을 차단하는 문제 회피.)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ branchId: string }> }
) {
  const { branchId } = await params;
  const ctx = await resolveBranchContext(branchId);
  if (!ctx) {
    return NextResponse.json({ error: "INVALID_BRANCH_OR_NO_ACTIVE_ROUND" }, { status: 404 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const kind = form?.get("kind");
  if (!(file instanceof File) || (kind !== "initial" && kind !== "action")) {
    return NextResponse.json({ error: "INVALID_UPLOAD" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const folder = `bms/${ctx.roundId}/${ctx.branchId}/${kind}`;

  try {
    const result = await uploadImageBuffer(buffer, folder);
    return NextResponse.json({ public_id: result.public_id });
  } catch {
    return NextResponse.json({ error: "UPLOAD_FAILED" }, { status: 502 });
  }
}
