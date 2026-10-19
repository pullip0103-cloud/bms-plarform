import LogoutButton from "@/app/components/LogoutButton";

export default function RegionLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <nav className="bg-gray-900 text-white px-6 py-2 flex items-center text-sm">
        <span>지역본부</span>
        <div className="flex-1" />
        <LogoutButton />
      </nav>
      {children}
    </div>
  );
}
