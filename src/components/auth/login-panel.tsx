"use client";

import { useState } from "react";
import { ArrowRight, Mail } from "lucide-react";
import { signIn } from "next-auth/react";

declare global {
  interface Window {
    vaultTrack?: (eventName: string, params?: Record<string, unknown>) => void;
  }
}

export function LoginPanel({
  hasGoogleAuth,
  hasEmailMagicLink,
  hasOwnerPasswordAuth,
  ownerEmail,
}: {
  hasGoogleAuth: boolean;
  hasEmailMagicLink: boolean;
  hasOwnerPasswordAuth: boolean;
  ownerEmail?: string;
}) {
  const [email, setEmail] = useState(ownerEmail ?? "");
  const [password, setPassword] = useState("");
  const [emailPending, setEmailPending] = useState(false);
  const [passwordPending, setPasswordPending] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  return (
    <div className="rounded-[32px] border border-stone-300/80 bg-white/90 p-8 shadow-[0_30px_90px_-45px_rgba(70,36,18,0.4)] backdrop-blur">
      <h1 className="text-3xl font-semibold tracking-[-0.04em] text-stone-950">Sign in</h1>
      <p className="mt-3 text-sm leading-7 text-stone-600">Approved owner accounts only.</p>

      <div className="mt-8 space-y-4">
        {hasGoogleAuth ? (
          <button
            type="button"
            onClick={() => {
              window.vaultTrack?.("access_login_submit", {
                method: "google",
              });
              void signIn("google", { callbackUrl: "/services" });
            }}
            className="flex w-full items-center justify-between rounded-[22px] border border-stone-300 bg-stone-950 px-5 py-4 text-left text-sm font-medium text-stone-50 transition hover:bg-stone-800"
          >
            <span>Continue with Google</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        ) : null}

        {hasOwnerPasswordAuth ? (
          <form
            className="rounded-[22px] border border-stone-300 bg-stone-50 p-4"
            onSubmit={async (event) => {
              event.preventDefault();
              setPasswordPending(true);
              setPasswordError("");
              window.vaultTrack?.("access_login_submit", {
                method: "password",
              });

              try {
                const result = await signIn("owner-password", {
                  email,
                  password,
                  callbackUrl: "/services",
                  redirect: false,
                });

                if (result?.error) {
                  setPasswordError("That email or password didn’t work.");
                  window.vaultTrack?.("access_login_error", {
                    method: "password",
                  });
                  return;
                }

                window.vaultTrack?.("access_login_success", {
                  method: "password",
                });
                window.location.href = result?.url ?? "/services";
              } finally {
                setPasswordPending(false);
              }
            }}
          >
            <label className="mb-3 block text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
              Email and password
            </label>
            <div className="space-y-3">
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-12 w-full rounded-full border border-stone-300 bg-white px-4 text-sm text-stone-950 outline-none transition focus:border-amber-500"
                placeholder="you@example.com"
              />
              <input
                type="password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-12 w-full rounded-full border border-stone-300 bg-white px-4 text-sm text-stone-950 outline-none transition focus:border-amber-500"
                placeholder="Owner password"
              />
              <button
                type="submit"
                disabled={passwordPending}
                className="inline-flex h-12 w-full items-center justify-center rounded-full bg-stone-950 px-5 text-sm font-medium text-stone-50 transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {passwordPending ? "Checking…" : "Sign in with password"}
              </button>
              {passwordError ? (
                <p className="text-sm text-rose-700">{passwordError}</p>
              ) : (
                <p className="text-xs leading-6 text-stone-500">
                  Temporary backup sign-in for now.
                </p>
              )}
            </div>
          </form>
        ) : null}

        {hasEmailMagicLink ? (
          <form
            className="rounded-[22px] border border-stone-300 bg-stone-50 p-4"
            onSubmit={async (event) => {
              event.preventDefault();
              setEmailPending(true);
              window.vaultTrack?.("access_login_submit", {
                method: "magic_link",
              });
              try {
                await signIn("email", {
                  email,
                  callbackUrl: "/services",
                });
                window.vaultTrack?.("access_login_success", {
                  method: "magic_link",
                });
              } finally {
                setEmailPending(false);
              }
            }}
          >
            <label className="mb-3 block text-xs font-semibold uppercase tracking-[0.2em] text-stone-500">
              Magic link
            </label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-12 w-full rounded-full border border-stone-300 bg-white pl-11 pr-4 text-sm text-stone-950 outline-none transition focus:border-amber-500"
                />
              </div>
              <button
                type="submit"
                disabled={emailPending}
                className="inline-flex h-12 items-center justify-center rounded-full bg-amber-600 px-5 text-sm font-medium text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {emailPending ? "Sending…" : "Send magic link"}
              </button>
            </div>
          </form>
        ) : null}

        {!hasGoogleAuth && !hasEmailMagicLink && !hasOwnerPasswordAuth ? (
          <div className="rounded-[22px] border border-dashed border-orange-300 bg-orange-50 p-4 text-sm leading-7 text-orange-900">
            Configure Google auth, magic-link email, or a simple owner password to unlock login.
          </div>
        ) : null}
      </div>
    </div>
  );
}
