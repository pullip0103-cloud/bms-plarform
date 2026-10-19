import { NextRequest, NextResponse } from "next/server";
import { requireHq } from "@/lib/authz";
import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";

export async function GET() {
  try {
    await requireHq();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 403 });
  }

  const [branchesSnap, regionsSnap] = await Promise.all([
    adminDb.collection("branches").orderBy("name").get(),
    adminDb.collection("regions").get(),
  ]);

  const regionNameById = new Map(regionsSnap.docs.map((d) => [d.id, d.data().name as string]));

  const branches = branchesSnap.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      name: data.name,
      branchType: data.branchType,
      isActive: data.isActive,
      regionId: data.regionId,
      regionName: regionNameById.get(data.regionId) ?? "",
      needsTypeReview: !!data.needsTypeReview,
    };
  });

  return NextResponse.json({ branches });
}

// 지점 1건 등록. 공유 링크(/s) 방식이라 별도 토큰 발급은 필요 없다 —
// 지역본부 선택 -> 지점 목록에서 바로 노출된다.
export async function POST(req: NextRequest) {
  try {
    await requireHq();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const name = (body?.name as string | undefined)?.trim();
  const regionId = body?.regionId as string | undefined;
  const branchType = (body?.branchType as string | undefined) ?? "대리점";

  if (!name || !regionId) {
    return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }

  const branchRef = await adminDb.collection("branches").add({
    name,
    regionId,
    branchType,
    isActive: true,
    needsTypeReview: false,
    createdAt: Timestamp.now(),
  });

  const created = await branchRef.get();
  return NextResponse.json({ branch: { id: branchRef.id, ...created.data() } });
}
