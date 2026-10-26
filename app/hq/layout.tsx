import Link from "next/link";

export default function HqLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <nav className="bg-gray-900 text-white px-6 py-2 flex gap-4 text-sm items-center">
        <Link href="/hq/admin">관리 설정</Link>
      </nav>
      {children}
    </div>
  );
}
