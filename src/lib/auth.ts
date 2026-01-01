import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async signIn({ account, profile }) {
      // Allow all Google sign-ins (optionally restrict by domain if ALLOWED_DOMAIN is set)
      if (account?.provider === "google") {
        const email = profile?.email;
        const allowedDomain = process.env.ALLOWED_DOMAIN;

        // If ALLOWED_DOMAIN is set, restrict to that domain
        if (allowedDomain && !email?.endsWith(`@${allowedDomain}`)) {
          return false;
        }

        return !!email; // Allow if email exists
      }
      return false;
    },
    async session({ session, token }) {
      // Add user info to session
      if (token && session.user) {
        session.user.id = token.sub!;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
  },
});
