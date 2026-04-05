import Link from "next/link";
import { KeyRound } from "lucide-react";

import { AppNav } from "@/components/auth/app-nav";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await requireSession();

  return (
    <div className="min-h-screen px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="app-shell-header rounded-[32px] px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/services"
                  className="app-button-primary inline-flex items-center gap-3 rounded-full px-4 py-2 text-sm font-medium"
                >
                  <KeyRound className="h-4 w-4" />
                  Access
                </Link>
                <span className="app-button-secondary rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em]">
                  {session.user.email ?? "Owner"}
                </span>
              </div>
              <p className="app-text-muted max-w-2xl text-sm leading-7">
                Your private place for service keys, notes, and agent access.
              </p>
            </div>

            <div className="flex flex-col gap-3 xl:items-end">
              <AppNav />
              <div className="flex justify-start xl:justify-end">
                <SignOutButton />
              </div>
            </div>
          </div>
        </header>

        <main className="pb-10">{children}</main>
      </div>
    </div>
  );
}
