import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";

const SESSION_COOKIE = "session";
const EXPIRES_IN = 60 * 60 * 24 * 14 * 1000; // 14일

// 로그인: 브라우저가 Firebase 클라이언트 SDK로 로그인해 받은 idToken을
// 서버가 세션 쿠키로 교환한다 (Firebase Admin SDK 공식 패턴).
export async function POST(req: NextRequest) {
  const { idToken } = await req.json().catch(() => ({}));
  if (!idToken) return NextResponse.json({ error: "MISSING_ID_TOKEN" }, { status: 400 });

  try {
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn: EXPIRES_IN });
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, sessionCookie, {
      maxAge: EXPIRES_IN / 1000,
      httpOnly: true,
      secure: true,
      path: "/",
      sameSite: "lax",
    });
    return res;
  } catch {
    return NextResponse.json({ error: "INVALID_ID_TOKEN" }, { status: 401 });
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
