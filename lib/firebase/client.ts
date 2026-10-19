import { getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// 브라우저용 — region/hq 로그인(이메일/비밀번호)에만 사용한다.
// 지점(토큰) 화면은 Firebase 클라이언트 SDK를 전혀 쓰지 않고 항상 서버 API Route를 거친다.
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const clientAuth = getAuth(app);
