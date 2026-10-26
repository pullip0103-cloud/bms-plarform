// 세 화면(지점/대리점용·지역본부용·본사용)이 기본적으로 같은 모양이라는 걸
// 한눈에 구분할 수 있도록, 화면 맨 위에 어떤 권한용 화면인지 표시한다.
export default function ScreenBadge({ label }: { label: string }) {
  return (
    <div className="bg-gray-900 text-white text-sm font-semibold text-center py-1.5 tracking-wide">
      {label}
    </div>
  );
}
