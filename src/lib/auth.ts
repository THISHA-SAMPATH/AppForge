import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import { prisma } from "./prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET || "default_auth_secret_for_local_development_purposes_only_987654321",
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "placeholder_google_client_id",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "placeholder_google_client_secret",
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID || "placeholder_github_client_id",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "placeholder_github_client_secret",
    }),
  ],
  session: {
    strategy: "database",
  },
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
