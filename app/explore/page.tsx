"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import Navbar from "@/app/components/Navbar"
import FollowButton from "@/app/components/FollowButton"
import Link from "next/link"
import { BookIcon, UserIcon, PlateIcon, ClockIcon } from "@/app/components/Icons"

function CookbookCard({ cookbook }: { cookbook: any }) {
  return (
    <Link
      href={`/share/cookbook/${cookbook.id}`}
      className="bg-white border border-gray-100 rounded-2xl overflow-hidden hover:shadow-md transition group block"
    >
      <div
        className="h-28 flex items-center justify-center overflow-hidden"
        style={{ backgroundColor: cookbook.cover_image ? "transparent" : (cookbook.cover_color || "#F97316") + "22" }}
      >
        {cookbook.cover_image ? (
          <img src={cookbook.cover_image} className="w-full h-full object-cover" />
        ) : (
          <span className="text-5xl">{cookbook.cover_emoji || "📖"}</span>
        )}
      </div>
      <div className="p-3">
        <div className="font-medium text-sm text-gray-900 truncate group-hover:text-orange-500 transition">{cookbook.title}</div>
        <div className="flex items-center gap-1.5 mt-1">
          {cookbook.owner_image ? (
            <img src={cookbook.owner_image} className="w-4 h-4 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div className="w-4 h-4 rounded-full bg-orange-400 flex items-center justify-center text-white text-[8px] font-bold flex-shrink-0">
              {cookbook.owner_name?.charAt(0)}
            </div>
          )}
          <span className="text-xs text-gray-400 truncate">@{cookbook.owner_username}</span>
        </div>
        <div className="text-xs text-gray-400 mt-1.5">
          {cookbook.recipe_count} {cookbook.recipe_count === 1 ? "recipe" : "recipes"}
        </div>
      </div>
    </Link>
  )
}

function UserCard({ user }: { user: any }) {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center justify-between gap-4 hover:shadow-sm transition">
      <Link href={`/u/${user.username}`} className="flex items-center gap-3 flex-1 min-w-0">
        {user.profile_image ? (
          <img src={user.profile_image} className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
        ) : (
          <div className="w-11 h-11 rounded-full bg-orange-500 flex items-center justify-center text-white text-base font-medium flex-shrink-0">
            {user.name?.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <div className="font-medium text-sm text-gray-900 truncate">{user.name}</div>
          <div className="text-xs text-gray-400">@{user.username}</div>
          {user.bio && <div className="text-xs text-gray-500 mt-0.5 truncate">{user.bio}</div>}
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
            <span>{user.follower_count} {user.follower_count === 1 ? "follower" : "followers"}</span>
            {user.cookbook_count > 0 && (
              <>
                <span>·</span>
                <span>{user.cookbook_count} {user.cookbook_count === 1 ? "cookbook" : "cookbooks"}</span>
              </>
            )}
          </div>
        </div>
      </Link>
      <div className="flex-shrink-0">
        <FollowButton username={user.username} />
      </div>
    </div>
  )
}

function RecipeCard({ recipe }: { recipe: any }) {
  return (
    <Link
      href={`/share/cookbook/${recipe.cookbook_id}`}
      className="bg-white border border-gray-100 rounded-2xl overflow-hidden hover:shadow-md transition group flex gap-3 p-3 items-center"
    >
      {recipe.image_url ? (
        <img src={recipe.image_url} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
      ) : (
        <div className="w-14 h-14 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0 text-orange-300">
          <PlateIcon size={24} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="font-medium text-sm text-gray-900 truncate group-hover:text-orange-500 transition">{recipe.title}</div>
        <div className="text-xs text-gray-400 truncate mt-0.5">in {recipe.cookbook_title}</div>
        <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
          {recipe.prep_time && <span className="flex items-center gap-1"><ClockIcon size={10} />{recipe.prep_time}</span>}
          {recipe.difficulty && <span>{recipe.difficulty}</span>}
        </div>
      </div>
    </Link>
  )
}

export default function ExplorePage() {
  const { status } = useSession()
  const router = useRouter()
  const [cookbooks, setCookbooks] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [recipes, setRecipes] = useState<any[]>([])
  const [query, setQuery] = useState("")
  const [activeTab, setActiveTab] = useState<"cookbooks" | "recipes" | "people">("cookbooks")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login?code=returning")
    if (status === "authenticated") fetchExplore("")
  }, [status])

  useEffect(() => {
    const timeout = setTimeout(() => fetchExplore(query), 300)
    return () => clearTimeout(timeout)
  }, [query])

  async function fetchExplore(q: string) {
    setLoading(true)
    const res = await fetch(`/api/explore?q=${encodeURIComponent(q)}`)
    const data = await res.json()
    setCookbooks(data.cookbooks || [])
    setUsers(data.users || [])
    setRecipes(data.recipes || [])
    setLoading(false)
  }

  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Loading...</div>
  }

  const isSearching = query.trim().length > 0

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-medium text-gray-900 mb-1">Explore</h1>
          <p className="text-sm text-gray-400">Discover cookbooks and people on SmartFlavr</p>
        </div>

        {/* Search */}
        <div className="relative mb-8">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8"/><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35"/>
          </svg>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search cookbooks, recipes, or people..."
            className="w-full bg-white border border-gray-200 rounded-2xl pl-10 pr-10 py-3 text-sm outline-none focus:border-orange-300 shadow-sm"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm">
              ✕
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-16">
            <div className="inline-block w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : isSearching ? (
          /* Search results — tabbed */
          <>
            <div className="flex gap-1 mb-6 bg-white border border-gray-100 rounded-xl p-1 w-fit shadow-sm">
              <button
                onClick={() => setActiveTab("cookbooks")}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${activeTab === "cookbooks" ? "bg-orange-500 text-white shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              >
                Cookbooks {cookbooks.length > 0 && <span className="ml-1 text-xs opacity-70">({cookbooks.length})</span>}
              </button>
              <button
                onClick={() => setActiveTab("recipes")}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${activeTab === "recipes" ? "bg-orange-500 text-white shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              >
                Recipes {recipes.length > 0 && <span className="ml-1 text-xs opacity-70">({recipes.length})</span>}
              </button>
              <button
                onClick={() => setActiveTab("people")}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${activeTab === "people" ? "bg-orange-500 text-white shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
              >
                People {users.length > 0 && <span className="ml-1 text-xs opacity-70">({users.length})</span>}
              </button>
            </div>

            {activeTab === "cookbooks" ? (
              cookbooks.length === 0 ? (
                <div className="text-center py-16">
                  <div className="text-gray-300 mb-3 flex justify-center"><BookIcon size={32} /></div>
                  <p className="text-sm text-gray-400">No cookbooks found for &ldquo;{query}&rdquo;</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {cookbooks.map(cb => <CookbookCard key={cb.id} cookbook={cb} />)}
                </div>
              )
            ) : activeTab === "recipes" ? (
              recipes.length === 0 ? (
                <div className="text-center py-16">
                  <div className="text-gray-300 mb-3 flex justify-center"><PlateIcon size={32} /></div>
                  <p className="text-sm text-gray-400">No recipes found for &ldquo;{query}&rdquo;</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {recipes.map(r => <RecipeCard key={r.id} recipe={r} />)}
                </div>
              )
            ) : (
              users.length === 0 ? (
                <div className="text-center py-16">
                  <div className="text-gray-300 mb-3 flex justify-center"><UserIcon size={32} /></div>
                  <p className="text-sm text-gray-400">No people found for &ldquo;{query}&rdquo;</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {users.map(u => <UserCard key={u.id} user={u} />)}
                </div>
              )
            )}
          </>
        ) : (
          /* Default view — two sections */
          <>
            {/* Trending Cookbooks */}
            <div className="mb-10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-gray-900">Trending Cookbooks</h2>
                <span className="text-xs text-gray-400">{cookbooks.length} public</span>
              </div>
              {cookbooks.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
                  <div className="text-gray-300 mb-3 flex justify-center"><BookIcon size={32} /></div>
                  <p className="text-sm text-gray-400">No public cookbooks yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {cookbooks.map(cb => <CookbookCard key={cb.id} cookbook={cb} />)}
                </div>
              )}
            </div>

            {/* People to Discover */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold text-gray-900">People to Discover</h2>
                <span className="text-xs text-gray-400">{users.length} members</span>
              </div>
              {users.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-2xl border border-gray-100">
                  <div className="text-gray-300 mb-3 flex justify-center"><UserIcon size={32} /></div>
                  <p className="text-sm text-gray-400">No other members yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {users.map(u => <UserCard key={u.id} user={u} />)}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
