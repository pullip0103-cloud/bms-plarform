"use client";

import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { clientAuth } from "@/lib/firebase/client";

export default function LogoutButton() {
  const router = useRouter();
  async function logout() {
    await signOut(clientAuth);
    await fetch("/api/auth/session", { method: "DELETE" });
    router.push("/login");
  }
  return (
    <button onClick={logout} className="text-sm text-gray-300 hover:text-white">
      로그아웃
    </button>
  );
}
