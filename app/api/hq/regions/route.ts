import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

export async function GET() {
  const snap = await adminDb.collection("regions").orderBy("name").get();
  const regions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return NextResponse.json({ regions });
}
