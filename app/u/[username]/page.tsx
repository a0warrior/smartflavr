import pool from "@/lib/db"
import { notFound } from "next/navigation"
import Link from "next/link"
import Image from "next/image"

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params

  const [users]: any = await pool.query(
    "SELECT id, name, image, username, bio, profile_image FROM users WHERE username = ?",
    [username]
  )

  if (users.length === 0) notFound()

  const user = users[0]
  const displayImage = user.profile_image || null
  const initials = user.name?.charAt(0).toUpperCase() || "?"

  const [cookbooks]: any = await pool.query(
    "SELECT * FROM cookbooks WHERE user_id = ? AND is_public = 1 ORDER BY created_at DESC",
    [user.id]
  )

  const [recipeCount]: any = await pool.query(
    "SELECT COUNT(*) as count FROM recipes WHERE user_id = ?",
    [user.id]
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Image src="/logo.svg" alt="SmartFlavr" width={36} height={36}/>
          <span className="text-lg font-medium">Smart<span className="text-orange-500">Flavr</span></span>
        </Link>
        <Link href="/dashboard" className="text-sm text-orange-500 hover:text-orange-600">My cookbooks →</Link>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="flex items-start gap-6 mb-10">
          {displayImage ? (
            <img src={displayImage} className="w-20 h-20 rounded-full object-cover flex-shrink-0"/>
          ) : (
            <div className="w-20 h-20 rounded-full bg-orange-500 flex items-center justify-center text-white text-3xl font-medium flex-shrink-0">
              {initials}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-medium text-gray-900 mb-1">{user.name}</h1>
            <p className="text-sm text-gray-400 mb-3">@{user.username}</p>
            {user.bio && <p className="text-sm text-gray-600 leading-relaxed max-w-md">{user.bio}</p>}
            <div className="flex gap-6 mt-4">
              <div className="text-center">
                <div className="text-lg font-medium text-gray-900">{cookbooks.length}</div>
                <div className="text-xs text-gray-400">Cookbooks</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-medium text-gray-900">{recipeCount[0].count}</div>
                <div className="text-xs text-gray-400">Recipes</div>
              </div>
            </div>
          </div>
        </div>

        <h2 className="text-lg font-medium mb-4">Public Cookbooks</h2>
        {cookbooks.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">📖</p>
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