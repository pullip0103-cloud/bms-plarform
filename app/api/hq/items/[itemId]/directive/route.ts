import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";

// 본사 조치지침 입력/변경/해제(초안): 마감 상태나 건의 조치결과 진행 여부와
// 무관하게 언제든지 입력하거나 바꿀 수 있다 — 입력 여부 자체가 본사의
// 선택이라 프로세스 단계로 게이팅할 필요가 없다. 이 값은 그 자체로는 상태를
// 바꾸지 않으며(별도 상태기계 없음 — 화면에서 directiveCode+actionPhotoPath로
// 파생 표시), 지역본부/지점 화면에는 해당 지역본부의 directivePublished가
// true일 때만 노출된다(서버가 join 시점에 조건부로 숨김). directiveCodeId를
// null로 보내면(=이미 선택된 코드를 다시 눌러 해제) 지침을 비운다.
//
// directiveComment(현장에 전달할 자유 텍스트 코멘트)는 directiveCodeId와
// 완전히 독립적으로 저장된다 — 코드를 안 바꿔도 코멘트만 수정 가능해야
// 해서, 요청 body에 각 필드가 "포함돼 있는지" 자체로 그 필드를 바꿀지
// 결정한다(hasOwnProperty 체크 — 값이 null이어도 "바꾸겠다"는 의도로 봄,
// 키 자체가 없으면 그 필드는 손대지 않음).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await params;

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }

  const itemRef = adminDb.collection("items").doc(itemId);
  const snap = await itemRef.get();
  if (!snap.exists) {
    return NextResponse.json({ error: "UPDATE_FAILED" }, { status: 409 });
  }

  const now = Timestamp.now();
  const update: Record<string, unknown> = {};

  if (Object.prototype.hasOwnProperty.call(body, "directiveCodeId")) {
    const directiveCodeId = (body.directiveCodeId ?? null) as string | null;
    if (directiveCodeId !== null) {
      const codeSnap = await adminDb.collection("directiveCodes").doc(directiveCodeId).get();
      if (!codeSnap.exists) {
        return NextResponse.json({ error: "INVALID_DIRECTIVE_CODE" }, { status: 400 });
      }
    }
    update.directiveCodeId = directiveCodeId;
    update.directiveIssuedAt = now;
  }

  if (Object.prototype.hasOwnProperty.call(body, "directiveComment")) {
    const directiveComment = (body.directiveComment as string | null)?.trim?.() || null;
    update.directiveComment = directiveComment;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "NO_FIELDS" }, { status: 400 });
  }

  update.updatedAt = now;
  await itemRef.update(update);

  const updated = await itemRef.get();
  return NextResponse.json({ item: { id: itemId, ...updated.data() } });
}
