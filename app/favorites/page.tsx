"use client"
import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Navbar from "@/app/components/Navbar"

export default function FavoritesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [favorites, setFavorites] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [removingId, setRemovingId] = useState<number | null>(null)

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
    if (status === "authenticated") fetchFavorites()
  }, [status])

  async function fetchFavorites() {
    setLoading(true)
    const res = await fetch("/api/favorites")
    const data = await res.json()
    setFavorites(data.favorites || [])
    setLoading(false)
  }

  async function removeFavorite(recipeId: number) {
    setRemovingId(recipeId)
    await fetch("/api/favorites", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipe_id: recipeId }),
    })
    setFavorites(prev => prev.filter(f => f.id !== recipeId))
    setRemovingId(null)
  }

  const filtered = favorites.filter(f =>
    f.title.toLowerCase().includes(search.toLowerCase()) ||
    f.cookbook_title?.toLowerCase().includes(search.toLowerCase())
  )

  const grouped = filtered.reduce((acc: any, recipe: any) => {
    const key = recipe.cookbook_title || "Unknown Cookbook"
    if (!acc[key]) acc[key] = { emoji: recipe.cover_emoji, color: recipe.cover_color, recipes: [] }
    acc[key].recipes.push(recipe)
    return acc
  }, {})

  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-10">

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-medium text-gray-900">My Favorites</h1>
            <p className="text-gray-500 text-sm mt-1">
              {favorites.length} recipe{favorites.length !== 1 ? "s" : ""} saved across all cookbooks
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <p className="text-sm text-gray-400">Loading favorites...</p>
          </div>
        ) : favorites.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center p-16 text-center">
            <span className="text-5xl mb-4">♡</span>
            <p className="text-gray-500 font-medium mb-1">No favorites yet</p>
            <p className="text-sm text-gray-400">Open any cookbook and tap the ♡ on a recipe to save it here</p>
            <button
              onClick={() => router.push("/dashboard")}
              className="mt-6 bg-orange-500 text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-orange-600 transition">
              Go to my cookbooks
            </button>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search favorites..."
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none"
              />
            </div>

            {filtered.length === 0 ? (
              <div className="text-center py-16 text-sm text-gray-400">No recipes match your search</div>
            ) : (
              <div className="space-y-8">
                {Object.entries(grouped).map(([cookbookTitle, group]: any) => (
                  <div key={cookbookTitle}>
                    <div className="flex items-center gap-2 mb-3">
                      <div
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-sm"
                        style={{ backgroundColor: group.color + "33" }}>
                        {group.emoji}
                      </div>
                      <h2 className="text-sm font-medium text-gray-700">{cookbookTitle}</h2>
                      <span className="text-xs text-gray-400">{group.recipes.length} recipe{group.recipes.length !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {group.recipes.map((recipe: any) => (
                        <div
                          key={recipe.id}
                          className="bg-white border border-gray-100 rounded-2xl overflow-hidden hover:shadow-sm transition group">
                          <div className="flex">
                            <div
                              className="w-20 h-20 flex-shrink-0 flex items-center justify-center overflow-hidden cursor-pointer"
                              style={{ backgroundColor: recipe.image_url ? "transparent" : group.color + "22" }}
                              onClick={() => router.push(`/cookbook/${recipe.cookbook_id}?recipe=${recipe.id}`)}>
                              {recipe.image_url ? (
                                <img src={recipe.image_url} className="w-full h-full object-cover"/>
                              ) : (
                                <span className="text-2xl">🍽️</span>
                              )}
                            </div>
                            <div className="flex-1 p-3 min-w-0">
                              <div
                                className="font-medium text-sm text-gray-900 truncate cursor-pointer hover:text-orange-500 transition"
                                onClick={() => router.push(`/cookbook/${recipe.cookbook_id}?recipe=${recipe.id}`)}>
                                {recipe.title}
                              </div>
                              <div className="flex gap-2 mt-1 flex-wrap">
                                {recipe.prep_time && <span className="text-xs text-gray-400">⏱ {recipe.prep_time}</span>}
                                {recipe.servings && <span className="text-xs text-gray-400">👤 {recipe.servings}</span>}
                                {recipe.difficulty && <span className="text-xs text-gray-400">★ {recipe.difficulty}</span>}
                              </div>
                              {recipe.description && (
                                <p className="text-xs text-gray-400 mt-1 line-clamp-1">{recipe.description}</p>
                              )}
                            </div>
                            <div className="flex flex-col items-center justify-center px-3 gap-2">
                              <button
                                onClick={() => router.push(`/cookbook/${recipe.cookbook_id}?recipe=${recipe.id}`)}
                                className="text-xs text-orange-500 hover:text-orange-600 transition">
                                Open →
                              </button>
                              <button
                                onClick={() => removeFavorite(recipe.id)}
                                disabled={removingId === recipe.id}
                                className="text-lg text-red-400 hover:text-red-300 transition">
                                {removingId === recipe.id ? "..." : "♥"}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}