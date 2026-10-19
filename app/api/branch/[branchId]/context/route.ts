import { NextRequest, NextResponse } from "next/server";
import { resolveBranchContext } from "@/lib/branchAuth";
import { adminDb } from "@/lib/firebase/admin";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ branchId: string }> }
) {
  const { branchId } = await params;
  const ctx = await resolveBranchContext(branchId);
  if (!ctx) {
    return NextResponse.json({ error: "INVALID_BRANCH_OR_NO_ACTIVE_ROUND" }, { status: 404 });
  }

  const itemsSnap = await adminDb
    .collection("items")
    .where("branchId", "==", ctx.branchId)
    .where("roundId", "==", ctx.roundId)
    .orderBy("createdAt", "asc")
    .get();

  const directiveCodeIds = new Set<string>();
  const items = itemsSnap.docs.map((doc) => {
    const data = doc.data() as Record<string, unknown> & { directiveCodeId?: string };
    if (data.directiveCodeId) directiveCodeIds.add(data.directiveCodeId);
    return { id: doc.id, ...data };
  });

  const codesById: Record<string, { label: string; description: string | null; requiresAction: boolean }> = {};
  await Promise.all(
    Array.from(directiveCodeIds).map(async (codeId) => {
      const codeSnap = await adminDb.collection("directiveCodes").doc(codeId).get();
      if (codeSnap.exists) {
        const d = codeSnap.data()!;
        codesById[codeId] = { label: d.label, description: d.description ?? null, requiresAction: d.requiresAction };
      }
    })
  );

  const itemsWithCodes = items.map((item) => ({
    ...item,
    directiveCode: item.directiveCodeId ? codesById[item.directiveCodeId] ?? null : null,
  }));

  return NextResponse.json({ context: ctx, items: itemsWithCodes });
}
