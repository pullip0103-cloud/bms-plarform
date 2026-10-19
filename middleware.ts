import { NextResponse, type NextRequest } from "next/server";

// region/hq 보호 경로의 1차 체크 — 세션 쿠키 존재 여부만 가볍게 확인한다.
// Edge 런타임에서는 firebase-admin(Node 전용)을 쓸 수 없으므로, 실제 토큰
// 검증(만료/위조 여부)은 각 페이지의 getCurrentProfile()에서 수행한다.
// 지점(/b/[token]) 경로는 세션 쿠키가 전혀 없으므로 이 미들웨어의 대상이 아니다.
export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isProtected = path.startsWith("/region") || path.startsWith("/hq");
  const hasSession = request.cookies.has("session");

  if (isProtected && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/region/:path*", "/hq/:path*"],
};
