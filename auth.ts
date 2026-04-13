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
        "SELECT id, status FROM users WHERE email = ?",
        [email]
      )

      if (existing.length > 0) {
        if (existing[0].status === "banned") {
          return "/banned"
        }
        if (existing[0].status === "suspended") {
          return "/suspended"
        }
        await pool.query(
          "UPDATE users SET name = ?, image = ? WHERE email = ?",
          [user.name, user.image, email]
        )
        return true
      }

      await pool.query(
        "INSERT INTO users (name, email, image) VALUES (?, ?, ?)",
        [user.name, email, user.image]
      )

      return true
    }
  }
})