import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";

export async function GET(req: NextRequest) {
  const roundId = req.nextUrl.searchParams.get("roundId");
  if (!roundId) return NextResponse.json({ error: "ROUND_ID_REQUIRED" }, { status: 400 });

  const snap = await adminDb
    .collection("directiveCodes")
    .where("roundId", "==", roundId)
    .orderBy("orderNo", "asc")
    .get();
  const codes = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return NextResponse.json({ codes });
}

export async function POST(req: NextRequest) {

  const body = await req.json().catch(() => null);
  const roundId = body?.roundId as string | undefined;
  const label = (body?.label as string | undefined)?.trim();
  const description = (body?.description as string | undefined)?.trim() || null;
  const requiresAction = body?.requiresAction !== false;
  const orderNo = body?.orderNo as number | undefined;

  if (!roundId || !label || orderNo === undefined) {
    return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }

  const docRef = await adminDb.collection("directiveCodes").add({
    roundId,
    orderNo,
    label,
    description,
    requiresAction,
    createdAt: Timestamp.now(),
  });

  const created = await docRef.get();
  return NextResponse.json({ code: { id: docRef.id, ...created.data() } });
}
