"use client";

import { useRouter } from "next/navigation";

export default function PortalLogoutButton({ className }: { className?: string }) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/portal/logout", { method: "POST" });
    router.push("/portal/login");
    router.refresh();
  }

  return (
    <button onClick={logout} className={className}>
      Log out
    </button>
  );
}
