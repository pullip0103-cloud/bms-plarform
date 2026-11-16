// scripts/seedDemoRegion.mjs로 만든 시연용 지역본부("국내마케팅2팀지역본부")와
// 소속 지점/대리점 8곳, 그리고 그 사이에 쌓였을 제작물(items)/잠금상태
// (roundRegionStatus/roundBranchStatus)까지 전부 지워 시연 이전 상태로
// 되돌린다. isDemo: true로 태깅된 문서만 지우므로 실제 운영 데이터는
// 건드리지 않는다.
// 실행: npm run remove:demoregion
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { DEMO_REGION_NAME } from "./seedDemoRegion.mjs";

async function main() {
  const app = initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
    }),
  });
  const db = getFirestore(app);

  const regionSnap = await db.collection("regions").where("name", "==", DEMO_REGION_NAME).get();
  if (regionSnap.empty) {
    console.log(`없음: ${DEMO_REGION_NAME} — 이미 원복된 상태`);
    process.exit(0);
  }
  const regionId = regionSnap.docs[0].id;

  const branchesSnap = await db.collection("branches").where("regionId", "==", regionId).get();
  const branchIds = branchesSnap.docs.map((d) => d.id);
  console.log(`지역본부 ${regionId} 소속 지점/대리점 ${branchIds.length}곳 발견`);

  // items는 branchId 단독 인덱스만 있고 roundId+branchId 조합이라, 전체를
  // 가져와 메모리에서 거르는 기존 프로젝트 관례를 그대로 쓴다.
  const itemsSnap = await db.collection("items").get();
  const branchIdSet = new Set(branchIds);
  const demoItems = itemsSnap.docs.filter((d) => branchIdSet.has(d.data().branchId));
  for (const doc of demoItems) await doc.ref.delete();
  console.log(`items 삭제: ${demoItems.length}건`);

  const regionStatusSnap = await db.collection("roundRegionStatus").where("regionId", "==", regionId).get();
  for (const doc of regionStatusSnap.docs) await doc.ref.delete();
  console.log(`roundRegionStatus 삭제: ${regionStatusSnap.size}건`);

  const branchStatusSnap = await db.collection("roundBranchStatus").where("regionId", "==", regionId).get();
  for (const doc of branchStatusSnap.docs) await doc.ref.delete();
  console.log(`roundBranchStatus 삭제: ${branchStatusSnap.size}건`);

  for (const doc of branchesSnap.docs) await doc.ref.delete();
  console.log(`branches 삭제: ${branchesSnap.size}건`);

  await db.collection("regions").doc(regionId).delete();
  console.log(`regions 삭제: ${DEMO_REGION_NAME}`);

  console.log("완료 — 시연 이전 상태로 원복됨");
  process.exit(0);
}

main();
