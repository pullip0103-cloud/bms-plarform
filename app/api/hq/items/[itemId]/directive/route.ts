import { NextRequest, NextResponse } from "next/server";
import { requireHq } from "@/lib/authz";
import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { isRegionClosedForItem } from "@/lib/regionLock";

// 본사 처리지침 부여: REGION_APPROVED -> DIRECTIVE_ISSUED
// (단, 선택한 코드가 requiresAction=false면 조치 불필요 -> 즉시 COMPLETED)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await params;
  try {
    await requireHq();
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const directiveCodeId = body?.directiveCodeId as string | undefined;
  if (!directiveCodeId) {
    return NextResponse.json({ error: "MISSING_DIRECTIVE_CODE" }, { status: 400 });
  }

  const codeSnap = await adminDb.collection("directiveCodes").doc(directiveCodeId).get();
  if (!codeSnap.exists) {
    return NextResponse.json({ error: "INVALID_DIRECTIVE_CODE" }, { status: 400 });
  }
  const requiresAction = codeSnap.data()!.requiresAction;
  const nextStatus = requiresAction ? "DIRECTIVE_ISSUED" : "COMPLETED";

  const itemRef = adminDb.collection("items").doc(itemId);
  const snap = await itemRef.get();
  if (!snap.exists || snap.data()!.status !== "REGION_APPROVED") {
    return NextResponse.json({ error: "UPDATE_FAILED" }, { status: 409 });
  }
  if (await isRegionClosedForItem(snap.data()!.regionId)) {
    return NextResponse.json({ error: "REGION_CLOSED" }, { status: 409 });
  }

  const now = Timestamp.now();
  await itemRef.update({
    directiveCodeId,
    status: nextStatus,
    directiveIssuedAt: now,
    updatedAt: now,
    ...(nextStatus === "COMPLETED" ? { hqDecidedAt: now } : {}),
  });

  await adminDb.collection("itemStatusLog").add({
    itemId,
    fromStatus: "REGION_APPROVED",
    toStatus: nextStatus,
    actorRole: "hq",
    createdAt: now,
  });

  const updated = await itemRef.get();
  return NextResponse.json({ item: { id: itemId, ...updated.data() } });
}
