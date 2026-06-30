import pool from "@/lib/db"
import { notFound } from "next/navigation"
import Link from "next/link"
import { auth } from "@/auth"
import FollowButton from "@/app/components/FollowButton"
import FollowersModal from "../../components/FollowersModal"
import CopyProfileLink from "@/app/components/CopyProfileLink"
import Navbar from "@/app/components/Navbar"
import { BookIcon } from "@/app/components/Icons"

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params

  const [users]: any = await pool.query(
    "SELECT id, name, email, image, username, bio, profile_image, is_admin FROM users WHERE username = ?",
    [username]
  )

  if (users.length === 0) notFound()

  const user = users[0]
  const isAdmin = user.is_admin === 1

  let userPlan = "free"
  try {
    const [planRows]: any = await pool.query("SELECT plan FROM users WHERE id = ?", [user.id])
    userPlan = planRows[0]?.plan || "free"
  } catch {}

  const displayImage = user.profile_image || null
  const initials = user.name?.charAt(0).toUpperCase() || "?"

  const session = await auth()
  const isOwnProfile = session?.user?.email && user.email === session.user.email

  const [cookbooks]: any = await pool.query(
    "SELECT * FROM cookbooks WHERE user_id = ? AND is_public = 1 ORDER BY created_at DESC",
    [user.id]
  )
  const [recipeCount]: any = await pool.query("SELECT COUNT(*) as count FROM recipes WHERE user_id = ?", [user.id])
  const [followerCount]: any = await pool.query("SELECT COUNT(*) as count FROM follows WHERE following_id = ?", [user.id])
  const [followingCount]: any = await pool.query("SELECT COUNT(*) as count FROM follows WHERE follower_id = ?", [user.id])

  return (
    <div className="min-h-screen bg-gray-50">
      <style>{`
        /* ── Plan badges ── */
        @keyframes sfProShimmer { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
        @keyframes sfPremiumShimmer { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
        .sf-pro-badge { background:linear-gradient(270deg,#f97316,#fb923c,#ea580c,#f97316); background-size:300% 300%; animation:sfProShimmer 3s ease infinite; box-shadow:0 0 8px rgba(249,115,22,0.5); }
        .sf-premium-badge { background:linear-gradient(270deg,#7c3aed,#a855f7,#6d28d9,#c026d3,#7c3aed); background-size:400% 400%; animation:sfPremiumShimmer 2.5s ease infinite; box-shadow:0 0 10px rgba(168,85,247,0.6); }

        /* ── Admin ring around avatar ── */
        @keyframes adminRing { 0%,100%{background-position:0% 50%} 50%{background-position:100% 50%} }
        .sf-admin-ring { background:linear-gradient(270deg,#fbbf24,#f97316,#ef4444,#f97316,#fbbf24); background-size:400% 400%; animation:adminRing 2s ease infinite; border-radius:9999px; padding:3px; display:inline-flex; }

        /* ── Admin badge ── */
        @keyframes adminBadge { 0%{background-position:-200% center} 100%{background-position:200% center} }
        .sf-admin-badge { background:linear-gradient(90deg,#78350f,#fbbf24,#f59e0b,#fbbf24,#78350f); background-size:200% auto; animation:adminBadge 2.5s linear infinite; box-shadow:0 0 14px rgba(251,191,36,0.55); color:#1c1917; }

        /* ── Admin hero glows ── */
        @keyframes adminGlow1 { 0%,100%{opacity:0.18} 50%{opacity:0.45} }
        @keyframes adminGlow2 { 0%,100%{opacity:0.12} 50%{opacity:0.35} }
        .sf-ag1 { animation:adminGlow1 3.5s ease-in-out infinite; }
        .sf-ag2 { animation:adminGlow2 4s ease-in-out infinite 1.2s; }
        .sf-ag3 { animation:adminGlow1 3s ease-in-out infinite 2s; }

        /* ── Floating particles ── */
        @keyframes sfFloat1 { 0%,100%{transform:translateY(0) scale(1);opacity:0.35} 50%{transform:translateY(-14px) scale(1.25);opacity:0.8} }
        @keyframes sfFloat2 { 0%,100%{transform:translateY(0) scale(1);opacity:0.2} 50%{transform:translateY(-20px) scale(0.8);opacity:0.6} }
        @keyframes sfFloat3 { 0%,100%{transform:translateY(0);opacity:0.4} 50%{transform:translateY(-10px);opacity:0.7} }
        .sf-p1{animation:sfFloat1 3.5s ease-in-out infinite;}
        .sf-p2{animation:sfFloat2 4.2s ease-in-out infinite 0.6s;}
        .sf-p3{animation:sfFloat3 3s ease-in-out infinite 1.1s;}
        .sf-p4{animation:sfFloat1 4.8s ease-in-out infinite 1.7s;}
        .sf-p5{animation:sfFloat2 3.3s ease-in-out infinite 2.3s;}
        .sf-p6{animation:sfFloat3 4s ease-in-out infinite 0.3s;}

        /* ── Admin hero border pulse ── */
        @keyframes adminBorder { 0%,100%{opacity:0.35} 50%{opacity:0.75} }
        .sf-admin-border { animation:adminBorder 3s ease-in-out infinite; }

        /* ── Admin hero title scan line ── */
        @keyframes scanLine { 0%{transform:translateX(-100%)} 100%{transform:translateX(400%)} }
        .sf-scan { animation:scanLine 3.5s linear infinite; }
      `}</style>

      <Navbar />
      {session?.user && (
        <div className="hidden md:block max-w-3xl mx-auto px-4 sm:px-6 pt-6">
          <Link href="/dashboard" className="text-sm text-orange-500 hover:text-orange-600 font-medium transition">Back to Dashboard</Link>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">

        {/* ── Admin hero banner ── */}
        {isAdmin && (
          <div className="relative overflow-hidden rounded-2xl mb-8" style={{ background: "linear-gradient(135deg,#0c0a09 0%,#1c1917 50%,#0c0a09 100%)" }}>

            {/* Glow orbs */}
            <div className="sf-ag1 absolute -top-20 -left-20 w-72 h-72 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle,rgba(251,191,36,0.25) 0%,transparent 70%)" }} />
            <div className="sf-ag2 absolute -bottom-20 -right-20 w-72 h-72 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle,rgba(249,115,22,0.2) 0%,transparent 70%)" }} />
            <div className="sf-ag3 absolute top-0 right-1/3 w-48 h-48 rounded-full pointer-events-none" style={{ background: "radial-gradient(circle,rgba(251,191,36,0.12) 0%,transparent 70%)" }} />

            {/* Floating particles */}
            <div className="sf-p1 absolute top-5 left-10 w-1.5 h-1.5 rounded-full bg-amber-400 pointer-events-none" />
            <div className="sf-p2 absolute top-10 left-1/4 w-1 h-1 rounded-full bg-orange-400 pointer-events-none" />
            <div className="sf-p3 absolute top-4 right-20 w-2 h-2 rounded-full bg-amber-300 pointer-events-none" />
            <div className="sf-p4 absolute bottom-5 left-16 w-1 h-1 rounded-full bg-orange-500 pointer-events-none" />
            <div className="sf-p5 absolute bottom-7 right-12 w-1.5 h-1.5 rounded-full bg-amber-400 pointer-events-none" />
            <div className="sf-p6 absolute top-1/2 left-2/3 w-1 h-1 rounded-full bg-yellow-300 pointer-events-none" />

            {/* Content */}
            <div className="relative z-10 px-6 py-10 text-center">
              <p className="text-xs text-amber-400/60 uppercase tracking-[0.35em] font-semibold mb-3">SmartFlavr Platform</p>

              {/* Title with shield icons */}
              <div className="flex items-center justify-center gap-3 mb-3">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                <div className="relative overflow-hidden">
                  <span className="text-2xl sm:text-3xl font-bold text-white tracking-wide">Administrator</span>
                  {/* scan line effect */}
                  <div className="sf-scan absolute inset-0 w-8 bg-gradient-to-r from-transparent via-amber-300/20 to-transparent skew-x-12 pointer-events-none" />
                </div>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </div>

              <p className="text-xs text-amber-300/50 tracking-wide">Full platform access · All features unlocked</p>
            </div>

            {/* Animated top & bottom border lines */}
            <div className="sf-admin-border absolute top-0 left-0 right-0 h-px pointer-events-none" style={{ background: "linear-gradient(90deg,transparent,rgba(251,191,36,0.7),transparent)" }} />
            <div className="sf-admin-border absolute bottom-0 left-0 right-0 h-px pointer-events-none" style={{ background: "linear-gradient(90deg,transparent,rgba(249,115,22,0.5),transparent)", animationDelay: "1.5s" }} />
          </div>
        )}

        {/* ── Profile header ── */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5 mb-8">
          <div className="flex items-start gap-4">

            {/* Avatar — with gold ring for admins */}
            {isAdmin ? (
              <div className="sf-admin-ring flex-shrink-0">
                <div className="rounded-full overflow-hidden bg-stone-950 p-[2px]">
                  {displayImage ? (
                    <img src={displayImage} className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover block" alt="" />
                  ) : (
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-orange-500 flex items-center justify-center text-white text-2xl sm:text-3xl font-medium">
                      {initials}
                    </div>
                  )}
                </div>
              </div>
            ) : displayImage ? (
              <img src={displayImage} className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover flex-shrink-0" alt="" />
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-orange-500 flex items-center justify-center text-white text-2xl sm:text-3xl font-medium flex-shrink-0">
                {initials}
              </div>
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <h1 className="text-xl sm:text-2xl font-medium text-gray-900 truncate">{user.name}</h1>

                {/* Admin badge */}
                {isAdmin && (
                  <span className="sf-admin-badge inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold flex-shrink-0">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                    Admin
                  </span>
                )}

                {/* Plan badges (only show if not admin, since admin badge is primary) */}
                {!isAdmin && userPlan === "pro" && (
                  <span className="sf-pro-badge inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold text-white flex-shrink-0">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>
                    Pro
                  </span>
                )}
                {!isAdmin && userPlan === "premium" && (
                  <span className="sf-premium-badge inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold text-white flex-shrink-0">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3l3.5 7L12 2l3.5 8L19 3l1 18H4L5 3z"/></svg>
                    Premium
                  </span>
                )}
              </div>

              <p className="text-sm text-gray-400 mb-2">@{user.username}</p>
              {user.bio && <p className="text-sm text-gray-600 leading-relaxed mb-3">{user.bio}</p>}

              <div className="flex flex-wrap gap-4 sm:gap-6">
                <div className="text-center">
                  <div className="text-base sm:text-lg font-medium text-gray-900">{cookbooks.length}</div>
                  <div className="text-xs text-gray-400">Public cookbooks</div>
                </div>
                <div className="text-center">
                  <div className="text-base sm:text-lg font-medium text-gray-900">{recipeCount[0].count}</div>
                  <div className="text-xs text-gray-400">Recipes</div>
                </div>
                <FollowersModal username={username} type="followers" count={followerCount[0].count} />
                <FollowersModal username={username} type="following" count={followingCount[0].count} />
              </div>
            </div>
          </div>

          <div className="flex gap-3 w-full sm:w-auto sm:flex-shrink-0">
            <CopyProfileLink username={username} className="flex-1 sm:flex-none text-center" />
            {isOwnProfile ? (
              <Link href="/profile/settings" className="flex-1 sm:flex-none text-center px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition">
                Edit profile
              </Link>
            ) : session?.user ? (
              <div className="flex-1 sm:flex-none"><FollowButton username={username} /></div>
            ) : null}
          </div>
        </div>

        <h2 className="text-lg font-medium mb-4">Public Cookbooks</h2>
        {cookbooks.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-gray-300 mb-3 flex justify-center"><BookIcon size={40} /></div>
            <p className="text-sm">No public cookbooks yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {cookbooks.map((book: any) => (
              <Link key={book.id} href={`/share/cookbook/${book.id}`} className="bg-white border border-gray-100 rounded-2xl overflow-hidden cursor-pointer hover:shadow-sm transition">
                <div className="h-24 flex items-center justify-center overflow-hidden"
                  style={{ backgroundColor: book.cover_image ? "transparent" : book.cover_color + "22" }}>
                  {book.cover_image ? (
                    <img src={book.cover_image} className="w-full h-full object-cover" alt="" />
                  ) : (
                    <span className="text-4xl">{book.cover_emoji}</span>
                  )}
                </div>
                <div className="p-3">
                  <div className="font-medium text-sm text-gray-900">{book.title}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
