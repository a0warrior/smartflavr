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
    "SELECT id, name, email, image, username, bio, profile_image, plan FROM users WHERE username = ?",
    [username]
  )

  if (users.length === 0) notFound()

  const user = users[0]
  const displayImage = user.profile_image || null
  const initials = user.name?.charAt(0).toUpperCase() || "?"

  const session = await auth()
  const isOwnProfile = session?.user?.email && user.email === session.user.email

  const [cookbooks]: any = await pool.query(
    "SELECT * FROM cookbooks WHERE user_id = ? AND is_public = 1 ORDER BY created_at DESC",
    [user.id]
  )

  const [recipeCount]: any = await pool.query(
    "SELECT COUNT(*) as count FROM recipes WHERE user_id = ?",
    [user.id]
  )

  const [followerCount]: any = await pool.query(
    "SELECT COUNT(*) as count FROM follows WHERE following_id = ?",
    [user.id]
  )

  const [followingCount]: any = await pool.query(
    "SELECT COUNT(*) as count FROM follows WHERE follower_id = ?",
    [user.id]
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <style>{`
        @keyframes sfProShimmer {
          0% { background-position: 0% 50% }
          50% { background-position: 100% 50% }
          100% { background-position: 0% 50% }
        }
        @keyframes sfPremiumShimmer {
          0% { background-position: 0% 50% }
          50% { background-position: 100% 50% }
          100% { background-position: 0% 50% }
        }
        .sf-pro-badge {
          background: linear-gradient(270deg, #f97316, #fb923c, #ea580c, #f97316);
          background-size: 300% 300%;
          animation: sfProShimmer 3s ease infinite;
          box-shadow: 0 0 8px rgba(249,115,22,0.5);
        }
        .sf-premium-badge {
          background: linear-gradient(270deg, #7c3aed, #a855f7, #6d28d9, #c026d3, #7c3aed);
          background-size: 400% 400%;
          animation: sfPremiumShimmer 2.5s ease infinite;
          box-shadow: 0 0 10px rgba(168,85,247,0.6);
        }
      `}</style>
      <Navbar />
      {session?.user && (
        <div className="hidden md:block max-w-3xl mx-auto px-4 sm:px-6 pt-6">
          <Link href="/dashboard" className="text-sm text-orange-500 hover:text-orange-600 font-medium transition">Back to Dashboard</Link>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5 mb-8">
          <div className="flex items-start gap-4">
            {displayImage ? (
              <img src={displayImage} className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover flex-shrink-0"/>
            ) : (
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-orange-500 flex items-center justify-center text-white text-2xl sm:text-3xl font-medium flex-shrink-0">
                {initials}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <h1 className="text-xl sm:text-2xl font-medium text-gray-900 truncate">{user.name}</h1>
                {user.plan === "pro" && (
                  <span className="sf-pro-badge inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold text-white flex-shrink-0">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>
                    Pro
                  </span>
                )}
                {user.plan === "premium" && (
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
                    <img src={book.cover_image} className="w-full h-full object-cover"/>
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