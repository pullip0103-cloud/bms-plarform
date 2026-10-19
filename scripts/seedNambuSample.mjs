// 남부지역본부 전수조사 PPT에서 추출한 실제 거점명+사진(nambu_items.json,
// nambu_images/)을 Cloudinary에 업로드하고 Firestore items로 투입한다.
// 처리지침/처리결과는 아직 작성되지 않은 상태를 재현하므로 전부 SUBMITTED로
// 생성하고, directiveCodeId/actionPhotoPath 등은 비워둔다(= 실제 화면에서 공백으로 보임).
//
// 중단 후 재실행해도 안전하도록, "이 라운드에 이미 들어간 item의 imageSourceFile"
// 집합을 Firestore에서 읽어 건너뛴다 (인덱스 카운트 방식 대신 — 중간에 네트워크가
// 끊겨도 정확히 처리된 것만 건너뛰고 중복 생성되지 않는다).
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { v2 as cloudinary } from "cloudinary";
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

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const items = JSON.parse(fs.readFileSync(path.join(__dirname, "nambu_items.json"), "utf8"));
const imagesDir = path.join(__dirname, "nambu_images");

// 1. 남부지역본부 + 진행중 라운드 확보
const regionSnap = await db.collection("regions").where("name", "==", "남부지역본부").limit(1).get();
if (regionSnap.empty) throw new Error("남부지역본부를 찾을 수 없습니다 (seed:regions 먼저 실행 필요)");
const regionId = regionSnap.docs[0].id;

let roundSnap = await db.collection("rounds").where("status", "==", "진행중").limit(1).get();
let roundId;
if (roundSnap.empty) {
  const roundRef = await db.collection("rounds").add({
    name: "2026년 하반기",
    status: "진행중",
    createdAt: Timestamp.now(),
  });
  roundId = roundRef.id;
  console.log("새 라운드 생성: 2026년 하반기 (" + roundId + ")");
} else {
  roundId = roundSnap.docs[0].id;
  console.log("기존 진행중 라운드 사용:", roundSnap.docs[0].data().name);
}

// 2. 남부지역본부 소속 branches를 이름으로 매핑
const branchesSnap = await db.collection("branches").where("regionId", "==", regionId).get();
const branchIdByName = new Map(branchesSnap.docs.map((d) => [d.data().name, d.id]));

// 3. 이미 처리된 소스 파일 집합 (imageSourceFile 필드로 식별 — 재실행 시 정확히 건너뜀)
const existingSnap = await db.collection("items").where("roundId", "==", roundId).get();
const doneImageFiles = new Set(
  existingSnap.docs.map((d) => d.data().imageSourceFile).filter(Boolean)
);
if (doneImageFiles.size > 0) {
  console.log(`이미 ${doneImageFiles.size}건 처리됨 — 나머지만 이어서 진행합니다.`);
}

let uploaded = 0;
let created = 0;
let skippedNoBranch = new Set();
let skippedOther = [];

for (const item of items) {
  if (doneImageFiles.has(item.imageFile)) continue;

  const branchId = branchIdByName.get(item.branchName);
  if (!branchId) {
    skippedNoBranch.add(item.branchName);
    continue;
  }

  // .emf(Windows 메타파일, PPT에 삽입된 벡터 도형/아이콘)는 Cloudinary가
  // 일반 이미지로 처리할 수 없어 건너뛴다.
  if (item.imageFile.toLowerCase().endsWith(".emf")) {
    skippedOther.push(`${item.imageFile} (${item.branchName}) - emf 포맷`);
    continue;
  }

  const imagePath = path.join(imagesDir, item.imageFile);
  if (!fs.existsSync(imagePath)) continue;

  try {
    const uploadResult = await cloudinary.uploader.upload(imagePath, {
      folder: `bms/${roundId}/${branchId}/initial`,
    });
    uploaded++;

    await db.collection("items").add({
      roundId,
      branchId,
      regionId,
      itemType: item.itemType,
      photoPath: uploadResult.public_id,
      imageSourceFile: item.imageFile, // 재실행 시 중복 방지 식별용
      note: null,
      status: "SUBMITTED",
      directiveCodeId: null,
      regionRejectReason: null,
      actionPhotoPath: null,
      hqRejectReason: null,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    created++;
  } catch (err) {
    skippedOther.push(`${item.imageFile} (${item.branchName}) - ${err.message ?? err}`);
    continue;
  }

  if (created % 20 === 0) console.log(`진행중... ${doneImageFiles.size + created}/${items.length}`);
}

console.log(`\n완료: 업로드 ${uploaded}건, items 생성 ${created}건`);
if (skippedNoBranch.size) {
  console.log("branches에서 매칭 못 한 거점명:", [...skippedNoBranch].join(", "));
}
if (skippedOther.length) {
  console.log("건너뜀 목록:");
  skippedOther.forEach((s) => console.log(" -", s));
}
process.exit(0);
