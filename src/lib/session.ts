import { ActorType } from "@prisma/client";
import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";

export async function getCurrentSession() {
  return getServerSession(authOptions);
}

export async function requireSession() {
  const session = await getCurrentSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  return session;
}

export function getAuditActorFromSession(session: Awaited<ReturnType<typeof getCurrentSession>>) {
  if (!session?.user?.id) {
    throw new Error("Authenticated session is required.");
  }

  return {
    actorType: ActorType.USER,
    actorId: session.user.id,
    actorLabel: session.user.email ?? session.user.name ?? "Scott Moran",
  } as const;
}
