import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

// 서버에서만 사용하는 Admin SDK. Supabase의 "service-role 클라이언트"에 대응한다 —
// 모든 데이터 접근은 반드시 서버 코드(API Route)가 역할(role)을 먼저 확인한 뒤
// 이 Admin SDK로 수행하며, Firestore 보안규칙은 클라이언트 직접접근을 전부
// 거부(deny-all)하는 2차 방어선으로만 둔다.
//
// 사진 저장은 Cloudinary를 쓰므로(lib/cloudinary.ts) Firebase Storage는 사용하지
// 않는다 — Storage의 Blaze(결제 등록) 요구사항을 완전히 피해간다.
//
// 지연 초기화(lazy init): 빌드 시점(next build의 "Collecting page data" 단계)에
// 환경변수가 placeholder이거나 비어 있어도 모듈 로드 자체는 실패하지 않도록,
// 실제 API 요청이 들어와 각 getter가 처음 호출될 때 초기화한다.
let app: App | null = null;

function getAdminApp(): App {
  if (app) return app;
  const apps = getApps();
  if (apps.length) {
    app = apps[0];
    return app;
  }
  app = initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL!,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
    }),
  });
  return app;
}

let _auth: Auth | null = null;
let _db: Firestore | null = null;

function bindIfFunction(value: unknown, thisArg: unknown) {
  return typeof value === "function" ? value.bind(thisArg) : value;
}

export const adminAuth: Auth = new Proxy({} as Auth, {
  get(_target, prop) {
    if (!_auth) _auth = getAuth(getAdminApp());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Admin SDK 메서드를 그대로 위임
    return bindIfFunction((_auth as any)[prop], _auth);
  },
});

export const adminDb: Firestore = new Proxy({} as Firestore, {
  get(_target, prop) {
    if (!_db) _db = getFirestore(getAdminApp());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Admin SDK 메서드를 그대로 위임
    return bindIfFunction((_db as any)[prop], _db);
  },
});
