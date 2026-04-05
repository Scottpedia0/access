import { LockKeyhole } from "lucide-react";
import { redirect } from "next/navigation";

import { LoginPanel } from "@/components/auth/login-panel";
import {
  hasEmailMagicLink,
  hasGoogleAuth,
  hasOwnerPasswordAuth,
  ownerEmails,
} from "@/lib/env";
import { getCurrentSession } from "@/lib/session";

export default async function LoginPage() {
  const session = await getCurrentSession();

  if (session?.user?.id) {
    redirect("/services");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-4 text-center">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-stone-300 bg-white/80 text-stone-900 shadow-[0_20px_40px_-35px_rgba(70,36,18,0.55)]">
            <LockKeyhole className="h-4 w-4" />
          </div>
          <h1 className="text-5xl font-semibold tracking-[-0.12em] text-stone-950 sm:text-6xl">
            BORING
          </h1>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-500">
            Authorized accounts only
          </p>
        </div>
        <LoginPanel
          hasGoogleAuth={hasGoogleAuth}
          hasEmailMagicLink={hasEmailMagicLink}
          hasOwnerPasswordAuth={hasOwnerPasswordAuth}
          ownerEmail={ownerEmails[0]}
        />
      </div>
    </main>
  );
}
