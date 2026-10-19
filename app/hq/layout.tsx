import Link from "next/link";
import LogoutButton from "@/app/components/LogoutButton";

export default function HqLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <nav className="bg-gray-900 text-white px-6 py-2 flex gap-4 text-sm items-center">
        <Link href="/hq">전체 현황</Link>
        <Link href="/hq/admin">관리 설정</Link>
        <div className="flex-1" />
        <LogoutButton />
      </nav>
      {children}
    </div>
  );
}
