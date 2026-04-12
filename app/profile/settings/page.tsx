"use client"
import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Navbar from "../../components/Navbar"

export default function ProfileSettings() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [bio, setBio] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login?code=returning")
    if (status === "authenticated") fetchProfile()
  }, [status])

  async function fetchProfile() {
    const res = await fetch("/api/profile")
    const data = await res.json()
    if (data.user) {
      setUsername(data.user.username || "")
      setBio(data.user.bio || "")
    }
  }

  async function saveProfile() {
    if (!username) {
      setError("Username is required")
      return
    }
    if (username.includes(" ")) {
      setError("Username cannot contain spaces")
      return
    }
    setLoading(true)
    setError("")
    setSuccess("")
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, bio }),
    })
    const data = await res.json()
    if (data.error) {
      setError(data.error)
    } else {
      setSuccess("Profile saved!")
    }
    setLoading(false)
  }

  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-lg mx-auto px-6 py-12">
        <div className="flex items-center gap-4 mb-8">
          {session?.user?.image && (
            <img src={session.user.image} className="w-16 h-16 rounded-full"/>
          )}
          <div>
            <h1 className="text-xl font-medium">{session?.user?.name}</h1>
            <p className="text-sm text-gray-400">{session?.user?.email}</p>
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-6">
          <h2 className="text-lg font-medium mb-6">Profile Settings</h2>

          <div className="mb-4">
            <label className="text-sm text-gray-500 mb-1 block">Username</label>
            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
              <span className="px-3 py-2 bg-gray-50 text-sm text-gray-400 border-r border-gray-200">smartflavr.com/u/</span>
              <input
                value={username}
                onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                placeholder="yourname"
                className="flex-1 px-3 py-2 text-sm outline-none"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">Only letters, numbers and underscores</p>
          </div>

          <div className="mb-6">
            <label className="text-sm text-gray-500 mb-1 block">Bio</label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="Tell people a bit about yourself and your cooking..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none outline-none"
              rows={3}
              maxLength={200}
            />
            <p className="text-xs text-gray-400 mt-1">{bio.length}/200</p>
          </div>

          {error && <p className="text-sm text-red-500 mb-4">{error}</p>}
          {success && <p className="text-sm text-green-600 mb-4">{success}</p>}

          <div className="flex gap-3">
            <button onClick={() => router.push("/dashboard")} className="flex-1 border border-gray-200 rounded-xl py-2 text-sm text-gray-500 hover:bg-gray-50">
              Cancel
            </button>
            <button onClick={saveProfile} disabled={loading} className="flex-1 bg-orange-500 text-white rounded-xl py-2 text-sm font-medium hover:bg-orange-600">
              {loading ? "Saving..." : "Save profile"}
            </button>
          </div>

          {username && (
            <div className="mt-4 p-3 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-400 mb-1">Your public profile</p>
              <a href={`/u/${username}`} target="_blank" className="text-sm text-orange-500">
                smartflavr.com/u/{username} ↗
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}