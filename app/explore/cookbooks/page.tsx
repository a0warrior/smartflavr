"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import Navbar from "@/app/components/Navbar"
import Link from "next/link"
import { BookIcon } from "@/app/components/Icons"

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

export default function AllCookbooksPage() {
  const { status } = useSession()
  const router = useRouter()
  const [cookbooks, setCookbooks] = useState<any[]>([])
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login?code=returning")
    if (status === "authenticated") fetch("/api/explore?type=cookbooks").then(r => r.json()).then(d => { setCookbooks(d.cookbooks || []); setLoading(false) })
  }, [status])

  useEffect(() => {
    if (status !== "authenticated") return
    const timeout = setTimeout(() => {
      setLoading(true)
      fetch(`/api/explore?type=cookbooks&q=${encodeURIComponent(query)}`).then(r => r.json()).then(d => { setCookbooks(d.cookbooks || []); setLoading(false) })
    }, 300)
    return () => clearTimeout(timeout)
  }, [query])

  const filtered = query ? cookbooks : cookbooks

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/explore" className="text-orange-500 hover:text-orange-600 text-sm font-medium">← Explore</Link>
          <span className="text-gray-300">/</span>
          <h1 className="text-xl font-semibold text-gray-900">All Cookbooks</h1>
        </div>

        <div className="relative mb-6">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8"/><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35"/>
          </svg>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search cookbooks..."
            className="w-full bg-white border border-gray-200 rounded-2xl pl-10 pr-10 py-3 text-sm outline-none focus:border-orange-300 shadow-sm"
          />
          {query && (
            <button onClick={() => setQuery("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">✕</button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-16"><div className="inline-block w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-gray-300 mb-3 flex justify-center"><BookIcon size={32} /></div>
            <p className="text-sm text-gray-400">{query ? `No cookbooks found for "${query}"` : "No public cookbooks yet"}</p>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-400 mb-4">{filtered.length} public {filtered.length === 1 ? "cookbook" : "cookbooks"}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {filtered.map(cb => <CookbookCard key={cb.id} cookbook={cb} />)}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
