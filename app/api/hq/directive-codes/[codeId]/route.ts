import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ codeId: string }> }
) {
  const { codeId } = await params;
  await adminDb.collection("directiveCodes").doc(codeId).delete();
  return NextResponse.json({ ok: true });
}
