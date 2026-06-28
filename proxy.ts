import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  const protectedRoutes = ["/cookbook", "/profile"]
  const isProtected = protectedRoutes.some(route => pathname.startsWith(route))

  if (isProtected) {
    // Must specify cookieName and salt to match the custom cookie name set in auth.ts.
    // Without these, getToken looks for the default name and returns null even when
    // the user is signed in, causing a redirect loop on every /cookbook visit.
    const token = await getToken({
      req,
      secret: process.env.NEXTAUTH_SECRET,
      cookieName: "next-auth.session-token",
      salt: "next-auth.session-token",
    })
    if (!token) {
      return NextResponse.redirect(new URL("/login?code=returning", req.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|logo.svg).*)"],
}
