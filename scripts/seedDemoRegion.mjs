// 팀 시연용 임시 지역본부("국내마케팅2팀지역본부")와 소속 지점/대리점
// 8곳을 생성한다. 지점/대리점 코드는 전부 "1103"으로 통일 — 시연 중
// 코드 입력 데모를 쉽게 보여주기 위함(실제 운영 코드와는 무관한 임의값).
// 며칠 뒤 시연이 끝나면 scripts/removeDemoRegion.mjs로 되돌린다.
// 실행: npm run seed:demoregion
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

export const DEMO_REGION_NAME = "국내마케팅2팀지역본부";
export const DEMO_CODE = "1103";
export const DEMO_BRANCHES = [
  { name: "서현", branchType: "지점" },
  { name: "효정", branchType: "지점" },
  { name: "은별", branchType: "지점" },
  { name: "유림", branchType: "지점" },
  { name: "태훈", branchType: "대리점" },
  { name: "형배", branchType: "대리점" },
  { name: "건우", branchType: "대리점" },
  { name: "동문", branchType: "대리점" },
];

async function main() {
  const app = initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
    }),
  });
  const db = getFirestore(app);

  const existing = await db.collection("regions").where("name", "==", DEMO_REGION_NAME).get();
  if (!existing.empty) {
    console.log(`이미 존재함: ${DEMO_REGION_NAME} (${existing.docs[0].id}) — 건너뜀`);
    process.exit(0);
  }

  const regionRef = await db.collection("regions").add({ name: DEMO_REGION_NAME, isDemo: true });
  console.log(`지역본부 생성: ${DEMO_REGION_NAME} (${regionRef.id})`);

  for (const b of DEMO_BRANCHES) {
    const branchRef = await db.collection("branches").add({
      name: b.name,
      regionId: regionRef.id,
      branchType: b.branchType,
      isActive: true,
      needsTypeReview: false,
      sourceCode: DEMO_CODE,
      isDemo: true,
      createdAt: new Date(),
    });
    console.log(`  ${b.branchType} 생성: ${b.name} (${branchRef.id})`);
  }

  console.log("완료 — regionId:", regionRef.id);
  process.exit(0);
}

// removeDemoRegion.mjs가 DEMO_REGION_NAME을 가져오려고 이 파일을 import할
// 때는 main()이 실행되면 안 된다(Firebase 앱 중복 초기화로 충돌) — 직접
// 실행된 경우(파일명이 argv[1]에 들어있는 경우)에만 돈다.
if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("seedDemoRegion.mjs")) {
  main();
}
