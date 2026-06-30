"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import Navbar from "@/app/components/Navbar"
import FollowButton from "@/app/components/FollowButton"
import Link from "next/link"
import { UserIcon } from "@/app/components/Icons"

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

export default function AllPeoplePage() {
  const { status } = useSession()
  const router = useRouter()
  const [users, setUsers] = useState<any[]>([])
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login?code=returning")
    if (status === "authenticated") fetch("/api/explore?type=people").then(r => r.json()).then(d => { setUsers(d.users || []); setLoading(false) })
  }, [status])

  useEffect(() => {
    if (status !== "authenticated") return
    const timeout = setTimeout(() => {
      setLoading(true)
      fetch(`/api/explore?type=people&q=${encodeURIComponent(query)}`).then(r => r.json()).then(d => { setUsers(d.users || []); setLoading(false) })
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
          <h1 className="text-xl font-semibold text-gray-900">All People</h1>
        </div>

        <div className="relative mb-6">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8"/><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35"/>
          </svg>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search people..."
            className="w-full bg-white border border-gray-200 rounded-2xl pl-10 pr-10 py-3 text-sm outline-none focus:border-orange-300 shadow-sm"
          />
          {query && (
            <button onClick={() => setQuery("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">✕</button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-16"><div className="inline-block w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : users.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-gray-300 mb-3 flex justify-center"><UserIcon size={32} /></div>
            <p className="text-sm text-gray-400">{query ? `No people found for "${query}"` : "No other members yet"}</p>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-400 mb-4">{users.length} {users.length === 1 ? "member" : "members"}</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {users.map(u => <UserCard key={u.id} user={u} />)}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
