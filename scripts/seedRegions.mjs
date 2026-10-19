// 전국 13개 지역본부 초기값을 Firestore에 입력한다.
// 실행: npm run seed:regions
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

// 실제 조직 체계상 전국 13개 지역본부 (대구/경북은 "대구경북지역본부"로 통합,
// 제주는 "광주전남지역본부" 소속 — 전수조사 PPT 수합 체계와 동일하게 맞춤).
const REGION_NAMES = [
  "강원지역본부",
  "경기지역본부",
  "경남지역본부",
  "광주전남지역본부",
  "남부지역본부",
  "대구경북지역본부",
  "대전지역본부",
  "동부지역본부",
  "부산지역본부",
  "서부지역본부",
  "인천지역본부",
  "전북지역본부",
  "충청지역본부",
];

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
  }),
});
const db = getFirestore(app);

const existing = await db.collection("regions").get();
const existingNames = new Set(existing.docs.map((d) => d.data().name));

for (const name of REGION_NAMES) {
  if (existingNames.has(name)) {
    console.log(`스킵 (이미 존재): ${name}`);
    continue;
  }
  await db.collection("regions").add({ name });
  console.log(`추가됨: ${name}`);
}

console.log("완료");
process.exit(0);
