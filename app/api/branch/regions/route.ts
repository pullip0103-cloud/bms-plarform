import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

// 공유 링크(/s) 첫 화면: 지역본부 선택 목록. 로그인 불필요(이름만 노출).
// 파라미터 없는 정적 경로라 Next.js가 빌드 시점에 미리 호출하려 하는데,
// 요청(req)을 참조해 "실제 요청이 와야 실행된다"고 명시해 이를 막는다.
export async function GET(req: NextRequest) {
  void req.headers;
  const snap = await adminDb.collection("regions").orderBy("name").get();
  const regions = snap.docs.map((d) => ({ id: d.id, name: d.data().name as string }));
  return NextResponse.json({ regions });
}
