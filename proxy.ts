import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

// ── Rate limiting ───────────────────────────────────────────────────────────
// In-memory, per-IP, fixed 60-second windows. The proxy runs in a single
// long-lived Node process on this host, so a Map is sufficient — no Redis
// needed at this scale. Limits are tiered so a flood against an expensive
// endpoint can't ride on the generous general allowance.

type Window = { count: number; resetAt: number }
const hits = new Map<string, Window>()
const WINDOW_MS = 60_000

const TIERS: { name: string; pattern: RegExp; limit: number }[] = [
  // AI endpoints cost real money per call (weekly plan caps exist, but this
  // stops a burst from burning a week's quota in seconds)
  { name: "ai", pattern: /^\/api\/(extract|extract-file|grocery-list|what-can-i-make|ai-assist)/, limit: 10 },
  // Brute-forceable: invite-code guessing, backup-secret guessing
  { name: "guessable", pattern: /^\/api\/(invite|backup)/, limit: 10 },
  // Uploads are large and consume Cloudinary quota
  { name: "upload", pattern: /^\/api\/(upload|upload-video)/, limit: 20 },
]
// Generous: normal pages fire many parallel API calls, and households share IPs
const GENERAL_LIMIT = 300

function rateLimit(ip: string, pathname: string): { ok: boolean; retryAfter: number } {
  const tier = TIERS.find(t => t.pattern.test(pathname))
  const limit = tier?.limit ?? GENERAL_LIMIT
  const key = `${ip}:${tier?.name ?? "general"}`
  const now = Date.now()

  const w = hits.get(key)
  if (!w || now >= w.resetAt) {
    hits.set(key, { count: 1, resetAt: now + WINDOW_MS })
    // Lazy cleanup so the map can't grow unbounded
    if (hits.size > 5000) {
      for (const [k, v] of hits) if (now >= v.resetAt) hits.delete(k)
    }
    return { ok: true, retryAfter: 0 }
  }

  w.count++
  if (w.count > limit) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((w.resetAt - now) / 1000)) }
  }
  return { ok: true, retryAfter: 0 }
}

// ── Proxy ───────────────────────────────────────────────────────────────────

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (pathname.startsWith("/api")) {
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown"
    const result = rateLimit(ip, pathname)
    if (!result.ok) {
      return NextResponse.json(
        { error: "Too many requests — slow down and try again in a minute." },
        { status: 429, headers: { "Retry-After": String(result.retryAfter) } }
      )
    }
    return NextResponse.next()
  }

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
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|logo.svg).*)",
    "/api/:path*",
  ],
}
