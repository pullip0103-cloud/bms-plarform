import { cookies } from "next/headers";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

export type Profile = {
  uid: string;
  role: "hq" | "region";
  regionId: string | null;
  displayName: string | null;
};

/**
 * 세션 쿠키(createSessionCookie로 발급)를 검증하고, Firestore의 profiles/{uid}
 * 문서에서 role/regionId를 읽어온다. region/hq 전용 API Route는 전부 이 함수로
 * 역할을 확인한 뒤 동작해야 한다.
 *
 * 권한 원칙 (설계 계획 참고):
 * - hq: 모든 region/branch/status/round에 대해 조건 없는 전체 조회. 지역본부의
 *   1차 확인 여부와 무관하게 항상 전체가 보여야 하므로, hq 조회 쿼리에는
 *   상태값/지역 필터를 "기본으로" 걸지 않는다 (화면에서 선택적으로만 좁힘).
 * - region: 자기 regionId 소속 건에 대해서만 전체 상태 조회 가능. 쓰기는
 *   SUBMITTED 상태 건의 승인/반려로만 제한.
 */
export async function getCurrentProfile(): Promise<Profile | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;
  if (!sessionCookie) return null;

  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    const snap = await adminDb.collection("profiles").doc(decoded.uid).get();
    if (!snap.exists) return null;
    const data = snap.data()!;
    return {
      uid: decoded.uid,
      role: data.role,
      regionId: data.regionId ?? null,
      displayName: data.displayName ?? null,
    };
  } catch {
    return null;
  }
}

export async function requireHq(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "hq") {
    throw new Error("UNAUTHORIZED_HQ_ONLY");
  }
  return profile;
}

export async function requireRegion(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "region" || !profile.regionId) {
    throw new Error("UNAUTHORIZED_REGION_ONLY");
  }
  return profile;
}
