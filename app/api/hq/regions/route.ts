import { NextResponse } from "next/server";
import { requireHq } from "@/lib/authz";
import { adminDb } from "@/lib/firebase/admin";

export async function GET() {
  try {
    await requireHq();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 403 });
  }
  const snap = await adminDb.collection("regions").orderBy("name").get();
  const regions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return NextResponse.json({ regions });
}
