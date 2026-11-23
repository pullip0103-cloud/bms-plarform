// 카카오톡 인앱 브라우저는 getUserMedia/카메라 전환이 불안정하게 동작하는
// 경우가 보고되어, 해당 환경이면 안내 배너를 띄우는 데 쓴다. 서버 렌더링
// 중에는 navigator가 없으므로 항상 false를 반환한다(클라이언트에서만 의미 있음).
export function isKakaoInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return navigator.userAgent.includes("KAKAOTALK");
}
