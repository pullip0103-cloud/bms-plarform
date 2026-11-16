import { adminDb } from "@/lib/firebase/admin";

/**
 * "활성 지점/대리점"(isActive==true) 조회를 한 곳에서 관리한다. 지점/대리점용(/s),
 * 지역본부용(/r), 본사용(/hq/{regionId}), 본사 관리설정(/hq/admin) 네 화면이
 * 각자 따로 `.where("isActive", "==", true)` 쿼리를 짜고 있어서, 관리설정만
 * 그 필터를 빠뜨렸던 적이 있다(삭제된 지점이 관리설정에만 계속 보이던 버그,
 * 2026-11-16) — 앞으로는 이 헬퍼만 거치면 네 화면이 항상 같은 기준으로
 * 동작한다.
 */
export function activeBranchesByRegionQuery(regionId: string) {
  return adminDb
    .collection("branches")
    .where("regionId", "==", regionId)
    .where("isActive", "==", true)
    .orderBy("name");
}

/**
 * 전국 전체(regionId 없이) 활성 지점 조회 — `isActive`+`name` 복합 인덱스가
 * Firestore에 없으므로(`regionId+isActive+name`만 등록돼 있음), 전체를
 * `orderBy("name")`만으로 가져온 뒤 메모리에서 `isActive`를 거른다.
 */
export async function fetchAllActiveBranches() {
  const snap = await adminDb.collection("branches").orderBy("name").get();
  return snap.docs.filter((d) => d.data().isActive === true);
}
