"use client"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import Link from "next/link"
import Navbar from "@/app/components/Navbar"
import FollowButton from "@/app/components/FollowButton"
import { PeopleIcon, SearchIcon } from "@/app/components/Icons"
import { PageSkeleton } from "@/app/components/Skeletons"

type Tab = "friends" | "following" | "followers"

function PersonRow({ user }: { user: any }) {
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
        </div>
      </Link>
      <div className="flex-shrink-0">
        <FollowButton username={user.username} />
      </div>
    </div>
  )
}

export default function FriendsPage() {
  const { status } = useSession()
  const router = useRouter()
  const [myUsername, setMyUsername] = useState("")
  const [tab, setTab] = useState<Tab>("friends")
  const [friends, setFriends] = useState<any[]>([])
  const [following, setFollowing] = useState<any[]>([])
  const [followers, setFollowers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState("")

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login?code=returning")
  }, [status, router])

  useEffect(() => {
    if (status !== "authenticated") return
    fetch("/api/profile").then(r => r.json()).then(d => {
      if (d.user?.username) setMyUsername(d.user.username)
    })
    fetch("/api/friends").then(r => r.json()).then(d => setFriends(d.friends || []))
  }, [status])

  useEffect(() => {
    if (!myUsername) return
    if (tab === "following" && following.length === 0) {
      fetch(`/api/follow/list?username=${myUsername}&type=following`).then(r => r.json()).then(d => setFollowing(d.users || []))
    }
    if (tab === "followers" && followers.length === 0) {
      fetch(`/api/follow/list?username=${myUsername}&type=followers`).then(r => r.json()).then(d => setFollowers(d.users || []))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, myUsername])

  useEffect(() => {
    setLoading(false)
  }, [friends])

  if (status === "loading" || loading) return <PageSkeleton />

  const lists: Record<Tab, any[]> = { friends, following, followers }
  const list = lists[tab]
  const q = query.trim().toLowerCase()
  const filtered = q ? list.filter(u => u.name?.toLowerCase().includes(q) || u.username?.toLowerCase().includes(q)) : list

  const emptyCopy: Record<Tab, string> = {
    friends: "No friends yet — follow someone and have them follow you back. Friends can collaborate on cookbooks, grocery lists, and meal plans.",
    following: "You're not following anyone yet.",
    followers: "No followers yet.",
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center gap-2 mb-6">
          <PeopleIcon size={20} className="text-orange-500" />
          <h1 className="text-xl font-semibold text-gray-900">Friends</h1>
        </div>

        <div className="flex gap-2 mb-5">
          {([
            ["friends", `Friends (${friends.length})`],
            ["following", "Following"],
            ["followers", "Followers"],
          ] as [Tab, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition ${tab === key ? "bg-orange-500 text-white" : "bg-white border border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
              {label}
            </button>
          ))}
        </div>

        {list.length > 5 && (
          <div className="relative mb-5">
            <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300"><SearchIcon size={14} /></div>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search..."
              className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none focus:border-orange-300"
            />
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-gray-300 mb-3 flex justify-center"><PeopleIcon size={32} /></div>
            <p className="text-sm text-gray-400 max-w-xs mx-auto leading-relaxed">
              {q ? `No matches for "${query}"` : emptyCopy[tab]}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filtered.map((u: any) => <PersonRow key={u.id} user={u} />)}
          </div>
        )}
      </div>
    </div>
  )
}
