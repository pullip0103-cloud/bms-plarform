import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";

// 본사 처리지침 입력/변경/해제(초안): 마감 상태나 건의 조치결과 진행 여부와
// 무관하게 언제든지 입력하거나 바꿀 수 있다 — 입력 여부 자체가 본사의
// 선택이라 프로세스 단계로 게이팅할 필요가 없다. 이 값은 그 자체로는 상태를
// 바꾸지 않으며(별도 상태기계 없음 — 화면에서 directiveCode+actionPhotoPath로
// 파생 표시), 지역본부/지점 화면에는 해당 지역본부의 directivePublished가
// true일 때만 노출된다(서버가 join 시점에 조건부로 숨김). directiveCodeId를
// null로 보내면(=이미 선택된 코드를 다시 눌러 해제) 지침을 비운다.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await params;

  const body = await req.json().catch(() => null);
  const directiveCodeId = (body?.directiveCodeId ?? null) as string | null;

  const itemRef = adminDb.collection("items").doc(itemId);
  const snap = await itemRef.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "UPDATE_FAILED" }, { status: 409 });
  }

  if (directiveCodeId !== null) {
    const codeSnap = await adminDb.collection("directiveCodes").doc(directiveCodeId).get();
    if (!codeSnap.exists) {
      return NextResponse.json({ error: "INVALID_DIRECTIVE_CODE" }, { status: 400 });
    }
  }

  const now = Timestamp.now();
  await itemRef.update({ directiveCodeId, directiveIssuedAt: now, updatedAt: now });

  const updated = await itemRef.get();
  return NextResponse.json({ item: { id: itemId, ...updated.data() } });
}
