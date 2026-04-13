"use client"
import { useState, useEffect } from "react"

export default function FollowButton({ username }: { username: string }) {
  const [isFollowing, setIsFollowing] = useState(false)
  const [isFriend, setIsFriend] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/follow?username=${username}`)
      .then(res => res.json())
      .then(data => {
        setIsFollowing(data.isFollowing)
        setIsFriend(data.isFriend)
        setLoading(false)
      })
  }, [username])

  async function toggleFollow() {
    setLoading(true)
    const method = isFollowing ? "DELETE" : "POST"
    await fetch("/api/follow", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    })
    const res = await fetch(`/api/follow?username=${username}`)
    const data = await res.json()
    setIsFollowing(data.isFollowing)
    setIsFriend(data.isFriend)
    setLoading(false)
  }

  if (loading) return <button className="px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-400">...</button>

  return (
    <button
      onClick={toggleFollow}
      className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
        isFriend
          ? "bg-green-50 text-green-700 border border-green-200 hover:bg-red-50 hover:text-red-500 hover:border-red-200"
          : isFollowing
          ? "bg-gray-100 text-gray-600 border border-gray-200 hover:bg-red-50 hover:text-red-500 hover:border-red-200"
          : "bg-orange-500 text-white hover:bg-orange-600"
      }`}>
      {isFriend ? "Friends ✓" : isFollowing ? "Following" : "Follow"}
    </button>
  )
}