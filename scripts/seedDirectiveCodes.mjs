// 현재 진행중(status: "진행중") 라운드의 처리지침 코드를, 실제 전수조사 지침
// PPT("처리 지침 유형_유지/철거/이동비치/판단불가/교체")에 정의된 ①~⑦ 7개
// 유형 그대로 재시딩한다. 기존 코드(유지/철거 2개뿐이던 임시값)는 삭제 후 교체.
// 실행: npm run seed:directives
import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

const CODES = [
  {
    orderNo: 1,
    label: "①유지",
    description:
      "기아 스튜디오 검수를 받은 본사 배포 제작물이거나, 해당 디자인을 활용하여 일부 내용만 변경한 제작물",
    requiresAction: false,
  },
  {
    orderNo: 2,
    label: "②유지",
    description: "BMS 위반 요소가 적어 철거 효율성 낮음",
    requiresAction: false,
  },
  {
    orderNo: 3,
    label: "③유지",
    description:
      "전시장 外 기타 공간(주차장, 사무실 등) 제작물로 철거 효율성 낮고 위반 요소 적어 판단 보류",
    requiresAction: false,
  },
  {
    orderNo: 4,
    label: "④철거",
    description: "BMS 미준수",
    requiresAction: true,
  },
  {
    orderNo: 5,
    label: "⑤철거 or 이동비치",
    description:
      "마케팅 콘텐츠(고객 대상 자료)가 아니지만 현장에 필요한 자료(납기표/조건표 등) — 이동 비치 시 고객 시선에 닿지 않는 곳에 비치",
    requiresAction: true,
  },
  {
    orderNo: 6,
    label: "⑥판단 불가",
    description: "제작물 식별 불가 — 지침 수신 시 내용 확인 후 재송부 必",
    requiresAction: true,
  },
  {
    orderNo: 7,
    label: "⑦교체",
    description: "변경된 표준 시안(표준 차명 기준 등)으로 교체 후 사진 재촬영",
    requiresAction: true,
  },
];

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
  }),
});
const db = getFirestore(app);

const roundSnap = await db.collection("rounds").where("status", "==", "진행중").limit(1).get();
if (roundSnap.empty) {
  console.error("진행중인 라운드가 없습니다.");
  process.exit(1);
}
const roundId = roundSnap.docs[0].id;
console.log(`대상 라운드: ${roundSnap.docs[0].data().name} (${roundId})`);

const existing = await db.collection("directiveCodes").where("roundId", "==", roundId).get();
for (const doc of existing.docs) {
  console.log(`기존 코드 삭제: ${doc.data().label}`);
  await doc.ref.delete();
}

for (const code of CODES) {
  await db.collection("directiveCodes").add({
    roundId,
    ...code,
    createdAt: Timestamp.now(),
  });
  console.log(`추가: ${code.label} (${code.requiresAction ? "조치 필요" : "조치 불필요"})`);
}

console.log("완료.");
