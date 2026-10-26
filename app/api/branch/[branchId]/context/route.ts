import { NextRequest, NextResponse } from "next/server";
import { resolveBranchContext } from "@/lib/branchAuth";
import { adminDb } from "@/lib/firebase/admin";
import { getRegionLockStatus } from "@/lib/regionLock";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ branchId: string }> }
) {
  const { branchId } = await params;
  const roundId = req.nextUrl.searchParams.get("roundId");
  const ctx = await resolveBranchContext(branchId, roundId);
  if (!ctx) {
    return NextResponse.json({ error: "INVALID_BRANCH_OR_NO_ACTIVE_ROUND" }, { status: 404 });
  }

  const lock = await getRegionLockStatus(ctx.roundId, ctx.regionId);

  const itemsSnap = await adminDb
    .collection("items")
    .where("branchId", "==", ctx.branchId)
    .where("roundId", "==", ctx.roundId)
    .orderBy("createdAt", "asc")
    .get();

  const showDirective = lock.directivePublished || ctx.isPastRound;

  const directiveCodeIds = new Set<string>();
  const items = itemsSnap.docs.map((doc) => {
    const data = doc.data() as Record<string, unknown> & { directiveCodeId?: string };
    if (showDirective && data.directiveCodeId) directiveCodeIds.add(data.directiveCodeId);
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
    directiveCode: showDirective && item.directiveCodeId ? codesById[item.directiveCodeId] ?? null : null,
  }));

  const roundsSnap = await adminDb.collection("rounds").orderBy("createdAt", "desc").get();
  const rounds = roundsSnap.docs.map((d) => ({
    id: d.id,
    name: d.data().name as string,
    status: d.data().status as string,
  }));

  return NextResponse.json({ context: ctx, items: itemsWithCodes, rounds });
}
