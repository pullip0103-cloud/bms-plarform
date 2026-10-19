import { NextRequest, NextResponse } from "next/server";
import { resolveBranchContext } from "@/lib/branchAuth";
import { createUploadSignature } from "@/lib/cloudinary";

/**
 * 브라우저가 사진 파일을 Next.js 서버를 거치지 않고 Cloudinary에 직접
 * 업로드할 수 있도록 서명(signature)을 발급한다.
 *
 * 1,000명 규모 지점이 반기 마감 직전 동시에 사진을 올릴 때, 모든 바이트가
 * 서버리스 함수를 통과하면 요청 본문 크기/실행시간 제한에 걸려 서비스가
 * 멈출 위험이 크다. 업로드 자체는 브라우저<->Cloudinary 간 직접 전송으로
 * 분리하고, 서버는 "이 지점이 이 경로에 쓸 수 있는가"만 짧게 검증하는
 * 서명 발급 역할만 한다.
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

  const body = await req.json().catch(() => null);
  const kind = body?.kind as "initial" | "action" | undefined;
  if (kind !== "initial" && kind !== "action") {
    return NextResponse.json({ error: "INVALID_KIND" }, { status: 400 });
  }

  const folder = `bms/${ctx.roundId}/${ctx.branchId}/${kind}`;
  const sig = createUploadSignature(folder);

  return NextResponse.json(sig);
}
