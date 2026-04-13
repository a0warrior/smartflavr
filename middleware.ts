import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  const protectedRoutes = ["/dashboard", "/cookbook", "/profile"]
  const isProtected = protectedRoutes.some(route => pathname.startsWith(route))

  if (isProtected) {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
    if (!token) {
      return NextResponse.redirect(new URL("/login?code=returning", req.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|logo.svg).*)"],
}