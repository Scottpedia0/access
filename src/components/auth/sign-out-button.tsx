"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="app-button-secondary inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium"
    >
      <LogOut className="h-4 w-4" />
      Sign out
    </button>
  );
}
