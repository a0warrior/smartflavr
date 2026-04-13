"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import Navbar from "@/app/components/Navbar"
import FollowButton from "@/app/components/FollowButton"
import Link from "next/link"

export default function ExplorePage() {
  const { status } = useSession()
  const router = useRouter()
  const [users, setUsers] = useState([])
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login?code=returning")
    if (status === "authenticated") fetchUsers("")
  }, [status])

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchUsers(query)
    }, 300)
    return () => clearTimeout(timeout)
  }, [query])

  async function fetchUsers(q: string) {
    setLoading(true)
    const res = await fetch(`/api/users?q=${encodeURIComponent(q)}`)
    const data = await res.json()
    setUsers(data.users || [])
    setLoading(false)
  }

  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-medium text-gray-900 mb-1">Explore</h1>
          <p className="text-sm text-gray-400">Find people and discover their cookbooks</p>
        </div>

        <div className="relative mb-8">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by name or username..."
            className="w-full bg-white border border-gray-200 rounded-2xl pl-10 pr-4 py-3 text-sm outline-none focus:border-orange-300 shadow-sm"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              ✕
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400 text-sm">Searching...</div>
        ) : users.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">👤</p>
            <p className="text-sm text-gray-400">
              {query ? `No users found for "${query}"` : "No other users yet"}
            </p>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-400 mb-4">
              {query ? `${users.length} result${users.length !== 1 ? "s" : ""} for "${query}"` : `${users.length} people on SmartFlavr`}
            </p>
            <div className="grid grid-cols-1 gap-3">
              {users.map((user: any) => (
                <div key={user.id} className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center justify-between gap-4 hover:shadow-sm transition">
                  <Link href={`/u/${user.username}`} className="flex items-center gap-4 flex-1 min-w-0">
                    {user.profile_image ? (
                      <img src={user.profile_image} className="w-12 h-12 rounded-full object-cover flex-shrink-0"/>
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-orange-500 flex items-center justify-center text-white text-lg font-medium flex-shrink-0">
                        {user.name?.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="font-medium text-sm text-gray-900">{user.name}</div>
                      <div className="text-xs text-gray-400">@{user.username}</div>
                      {user.bio && (
                        <div className="text-xs text-gray-500 mt-1 truncate">{user.bio}</div>
                      )}
                      <div className="text-xs text-gray-400 mt-1">
                        {user.follower_count} {user.follower_count === 1 ? "follower" : "followers"}
                      </div>
                    </div>
                  </Link>
                  <div className="flex-shrink-0">
                    <FollowButton username={user.username}/>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}