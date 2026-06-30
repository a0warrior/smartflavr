"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import Navbar from "@/app/components/Navbar"
import Link from "next/link"
import { PlateIcon, ClockIcon } from "@/app/components/Icons"

function RecipeCard({ recipe }: { recipe: any }) {
  return (
    <Link
      href={`/share/recipe/${recipe.id}`}
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
        <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
          {recipe.prep_time && <span className="flex items-center gap-1"><ClockIcon size={10} />{recipe.prep_time}</span>}
          {recipe.difficulty && <span>{recipe.difficulty}</span>}
        </div>
      </div>
    </Link>
  )
}

export default function AllRecipesPage() {
  const { status } = useSession()
  const router = useRouter()
  const [recipes, setRecipes] = useState<any[]>([])
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login?code=returning")
    if (status === "authenticated") fetch("/api/explore?type=recipes").then(r => r.json()).then(d => { setRecipes(d.trendingRecipes || []); setLoading(false) })
  }, [status])

  useEffect(() => {
    if (status !== "authenticated" || !query) return
    const timeout = setTimeout(() => {
      setLoading(true)
      fetch(`/api/explore?type=recipes&q=${encodeURIComponent(query)}`).then(r => r.json()).then(d => { setRecipes(d.recipes || d.trendingRecipes || []); setLoading(false) })
    }, 300)
    return () => clearTimeout(timeout)
  }, [query])

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/explore" className="text-orange-500 hover:text-orange-600 text-sm font-medium">← Explore</Link>
          <span className="text-gray-300">/</span>
          <h1 className="text-xl font-semibold text-gray-900">All Recipes</h1>
        </div>

        <div className="relative mb-6">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8"/><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35"/>
          </svg>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search recipes..."
            className="w-full bg-white border border-gray-200 rounded-2xl pl-10 pr-10 py-3 text-sm outline-none focus:border-orange-300 shadow-sm"
          />
          {query && (
            <button onClick={() => setQuery("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">✕</button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-16"><div className="inline-block w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : recipes.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-gray-300 mb-3 flex justify-center"><PlateIcon size={32} /></div>
            <p className="text-sm text-gray-400">{query ? `No recipes found for "${query}"` : "No public recipes yet"}</p>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-400 mb-4">{recipes.length} {query ? "matching" : "public"} {recipes.length === 1 ? "recipe" : "recipes"}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {recipes.map(r => <RecipeCard key={r.id} recipe={r} />)}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
