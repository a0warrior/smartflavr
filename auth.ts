import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import pool from "@/lib/db"

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  cookies: {
    sessionToken: {
      name: "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "none",
        path: "/",
        secure: true,
      },
    },
    pkceCodeVerifier: {
      name: "next-auth.pkce.code_verifier",
      options: {
        httpOnly: true,
        sameSite: "none",
        path: "/",
        secure: true,
      },
    },
  },
  providers: [Google({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    authorization: {
      params: {
        scope: "openid email profile https://www.googleapis.com/auth/calendar.events",
        access_type: "offline",
        prompt: "consent",
      }
    }
  })],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.access_token = account.access_token
        token.refresh_token = account.refresh_token
      }
      return token
    },
    async session({ session, token }) {
      session.access_token = token.access_token as string
      return session
    },
    async signIn({ user }) {
      const email = user.email
      if (!email) return false

      try {
        const [existing]: any = await pool.query(
          "SELECT id, status FROM users WHERE email = ?",
          [email]
        )

        if (existing.length > 0) {
          if (existing[0].status === "banned") return "/banned"
          if (existing[0].status === "suspended") return "/suspended"
          await pool.query(
            "UPDATE users SET name = ?, image = ? WHERE email = ?",
            [user.name, user.image, email]
          )
          return true
        }

        // New user: allow the NextAuth session but don't create a DB record yet.
        // Account creation requires a valid invite code, enforced in the dashboard.
        return true
      } catch (err) {
        console.error("SignIn DB error:", err)
        return false
      }
    }
  }
})