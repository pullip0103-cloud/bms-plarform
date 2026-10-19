// scripts/extractBranchesFromPpt.mjs로 추출한 branches_extracted.json을 Firestore에 입력한다.
// regions가 먼저 seedRegions.mjs로 생성되어 있어야 한다 (region명으로 매칭).
// 실행: npm run seed:branches
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
  }),
});
const db = getFirestore(app);

const extracted = JSON.parse(
  fs.readFileSync(path.join(__dirname, "branches_extracted.json"), "utf8")
);

const regionsSnap = await db.collection("regions").get();
const regionIdByName = new Map(regionsSnap.docs.map((d) => [d.data().name, d.id]));

const existingBranchesSnap = await db.collection("branches").get();
const existingKeys = new Set(
  existingBranchesSnap.docs.map((d) => d.data().regionId + "|" + d.data().name + "|" + d.data().branchType)
);

let created = 0;
let skipped = 0;
let missingRegion = 0;

for (const [regionName, branches] of Object.entries(extracted)) {
  const regionId = regionIdByName.get(regionName);
  if (!regionId) {
    console.error(`지역본부를 찾을 수 없음(먼저 seed:regions 실행 필요): ${regionName}`);
    missingRegion += branches.length;
    continue;
  }

  for (const b of branches) {
    // PPT에 "지점/대리점" 접미사가 생략되어 자동분류 안 된 건은 기본값 "대리점"으로 넣고,
    // 본사가 /hq/admin에서 실제 구분을 확인 후 보정하도록 note를 남긴다.
    const branchType = b.branchType === "미확인" ? "대리점" : b.branchType;
    const key = regionId + "|" + b.name + "|" + branchType;
    if (existingKeys.has(key)) {
      skipped++;
      continue;
    }

    await db.collection("branches").add({
      name: b.name,
      regionId,
      branchType,
      isActive: true,
      needsTypeReview: b.branchType === "미확인",
      createdAt: new Date(),
    });
    created++;
  }
}

console.log(`생성됨: ${created}, 스킵(이미 존재): ${skipped}, 지역본부 못찾음: ${missingRegion}`);
console.log("완료");
process.exit(0);
