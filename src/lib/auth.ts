import { timingSafeEqual } from "crypto";
import { ActorType, AuditAction } from "@prisma/client";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import EmailProvider from "next-auth/providers/email";
import GoogleProvider from "next-auth/providers/google";

import { createAuditEvent } from "@/lib/audit";
import {
  hasEmailMagicLink,
  hasGoogleAuth,
  hasOwnerPasswordAuth,
  isAllowedOwnerEmail,
} from "@/lib/env";
import { prisma } from "@/lib/prisma";

const providers = [];

async function ensureOwnerUser(email: string) {
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      name: "Owner",
    },
  });
}

function matchesOwnerPassword(input: string) {
  const configured = process.env.OWNER_LOGIN_PASSWORD;

  if (!configured) {
    return false;
  }

  const left = Buffer.from(input);
  const right = Buffer.from(configured);

  return left.length === right.length && timingSafeEqual(left, right);
}

if (hasGoogleAuth) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: false,
    }),
  );
}

if (hasEmailMagicLink) {
  providers.push(
    EmailProvider({
      server: process.env.EMAIL_SERVER,
      from: process.env.EMAIL_FROM,
      maxAge: 15 * 60,
    }),
  );
}

if (hasOwnerPasswordAuth) {
  providers.push(
    CredentialsProvider({
      id: "owner-password",
      name: "Owner password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, req) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password ?? "";

        if (!email || !isAllowedOwnerEmail(email) || !matchesOwnerPassword(password)) {
          const ip =
            (req?.headers && ("x-forwarded-for" in req.headers
              ? (Array.isArray(req.headers["x-forwarded-for"])
                  ? req.headers["x-forwarded-for"][0]
                  : req.headers["x-forwarded-for"]?.split(",")[0]?.trim())
              : req.headers["x-real-ip"])) || "unknown";

          console.warn(
            JSON.stringify({
              level: "warn",
              event: "auth_failure",
              reason: "invalid_credentials",
              ip,
              endpoint: "/api/auth/callback/owner-password",
              email: email || null,
              timestamp: new Date().toISOString(),
            }),
          );
          return null;
        }

        return ensureOwnerUser(email);
      },
    }),
  );
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ user }) {
      return isAllowedOwnerEmail(user.email);
    },
    async jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
      }

      if (user?.email) {
        token.email = user.email;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.email = (token.email as string | undefined) ?? session.user.email;
      }

      return session;
    },
  },
  events: {
    async signIn({ user }) {
      await createAuditEvent({
        actor: {
          actorType: ActorType.USER,
          actorId: user.id ?? "unknown-user",
          actorLabel: user.email ?? user.name ?? "Owner",
        },
        action: AuditAction.LOGIN_SUCCEEDED,
      });
    },
  },
};
