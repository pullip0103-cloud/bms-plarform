import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

// 공유 링크(/s) 두번째 화면: 선택한 지역본부 소속 지점/대리점 목록. 로그인 불필요.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ regionId: string }> }
) {
  const { regionId } = await params;
  const snap = await adminDb
    .collection("branches")
    .where("regionId", "==", regionId)
    .where("isActive", "==", true)
    .orderBy("name")
    .get();
  const branches = snap.docs.map((d) => ({
    id: d.id,
    name: d.data().name as string,
    branchType: d.data().branchType as string,
  }));
  return NextResponse.json({ branches });
}
