import { adminDb } from "@/lib/firebase/admin";

/**
 * 로그인 없이 링크만으로 접근하는 방식으로 전환했다 (추후 더 정교한 인증으로
 * 교체 예정). region 경로는 URL의 regionId를 그대로 신뢰하고, 그 지역이
 * 실제로 존재하는지만 확인한다. hq 경로는 별도 검증 없이 통과시킨다 —
 * "URL을 아는 사람만 접근"하는 수준의 보안이며, 민감한 개인정보를 다루지
 * 않는 사내 업무 데이터라 이 수준으로 충분하다고 판단.
 */
export async function resolveRegion(regionId: string): Promise<{ id: string; name: string } | null> {
  const snap = await adminDb.collection("regions").doc(regionId).get();
  if (!snap.exists) return null;
  return { id: snap.id, name: snap.data()!.name as string };
}
