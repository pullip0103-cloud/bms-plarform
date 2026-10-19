import { NextRequest, NextResponse } from "next/server";
import { requireHq } from "@/lib/authz";
import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";

type Row = { name: string; regionName: string; branchType?: string };

// CSV를 파싱한 결과(행 배열)를 받아 지점을 일괄 등록한다. 공유 링크(/s) 방식이라
// 토큰 발급은 필요 없음 — 등록 즉시 지역본부 선택 -> 지점 목록에 노출된다.
// 지역본부명은 기존 regions 컬렉션의 name과 매칭하며, 없으면 해당 행은 오류로 보고한다.
export async function POST(req: NextRequest) {
  try {
    await requireHq();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const rows = body?.rows as Row[] | undefined;
  if (!rows || !Array.isArray(rows)) {
    return NextResponse.json({ error: "ROWS_REQUIRED" }, { status: 400 });
  }

  const regionsSnap = await adminDb.collection("regions").get();
  const regionIdByName = new Map(regionsSnap.docs.map((d) => [d.data().name as string, d.id]));

  const results: { name: string; status: "ok" | "error"; message?: string }[] = [];

  for (const row of rows) {
    const regionId = regionIdByName.get(row.regionName?.trim());
    if (!row.name?.trim() || !regionId) {
      results.push({ name: row.name ?? "(이름없음)", status: "error", message: "지역본부명을 찾을 수 없습니다." });
      continue;
    }

    await adminDb.collection("branches").add({
      name: row.name.trim(),
      regionId,
      branchType: row.branchType?.trim() || "대리점",
      isActive: true,
      needsTypeReview: false,
      createdAt: Timestamp.now(),
    });

    results.push({ name: row.name, status: "ok" });
  }

  return NextResponse.json({ results });
}
