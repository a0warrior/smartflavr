import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import pool from "@/lib/db"

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  })],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ user }) {
      const email = user.email
      if (!email) return false

      const [existing]: any = await pool.query(
        "SELECT id FROM users WHERE email = ?",
        [email]
      )

      if (existing.length > 0) {
        return true
      }

      return false
    }
  }
})