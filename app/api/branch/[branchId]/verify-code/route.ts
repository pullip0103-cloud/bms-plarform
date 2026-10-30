import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

// 지점/대리점 선택 화면에서 입력한 코드가 실제 그 지점/대리점의 코드와
// 일치하는지 서버에서 확인한다. 대소문자는 구분하지 않는다. 코드 값
// 자체는 /api/branch/regions/{regionId}/branches 목록 응답에 포함하지
// 않으므로, 이 엔드포인트를 거치지 않고는 정답을 알아낼 수 없다.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ branchId: string }> }
) {
  const { branchId } = await params;
  const body = await req.json().catch(() => null);
  const code = (body?.code as string | undefined)?.trim();
  if (!code) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const snap = await adminDb.collection("branches").doc(branchId).get();
  if (!snap.exists || snap.data()?.isActive !== true) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const sourceCode = (snap.data()?.sourceCode as string | undefined) ?? "";
  const ok = sourceCode.length > 0 && sourceCode.toUpperCase() === code.toUpperCase();
  return NextResponse.json({ ok });
}
