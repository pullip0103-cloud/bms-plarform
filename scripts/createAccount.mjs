// region/hq 로그인 계정과 Firestore profiles 문서를 함께 생성한다.
// 실행 예시:
//   npm run create:account -- hq hq@example.com "비밀번호12345"
//   npm run create:account -- region region-gangwon@example.com "비밀번호12345" <강원지역본부_regionId>
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const [, , role, email, password, regionId] = process.argv;

if (!role || !email || !password || (role !== "hq" && role !== "region")) {
  console.error("사용법: node scripts/createAccount.mjs <hq|region> <이메일> <비밀번호> [regionId(region일 때 필수)]");
  process.exit(1);
}
if (role === "region" && !regionId) {
  console.error("region 역할은 regionId가 필요합니다 (Firestore의 regions 컬렉션 문서 ID).");
  process.exit(1);
}

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
  }),
});
const auth = getAuth(app);
const db = getFirestore(app);

const user = await auth.createUser({ email, password });
await db.collection("profiles").doc(user.uid).set({
  role,
  regionId: role === "region" ? regionId : null,
  displayName: email,
});

console.log(`계정 생성 완료: ${email} (uid=${user.uid}, role=${role})`);
process.exit(0);
