import { NextRequest, NextResponse } from "next/server";
import { requireHq } from "@/lib/authz";
import { adminDb } from "@/lib/firebase/admin";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ codeId: string }> }
) {
  const { codeId } = await params;
  try {
    await requireHq();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 403 });
  }
  await adminDb.collection("directiveCodes").doc(codeId).delete();
  return NextResponse.json({ ok: true });
}
