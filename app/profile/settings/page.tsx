"use client"
import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Navbar from "@/app/components/Navbar"

export default function ProfileSettings() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [bio, setBio] = useState("")
  const [profileImage, setProfileImage] = useState("")
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
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
      setProfileImage(data.user.profile_image || "")
    }
  }

  async function uploadProfilePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const reader = new FileReader()
    reader.onloadend = async () => {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: reader.result }),
      })
      const data = await res.json()
      if (data.success) {
        setProfileImage(data.url)
      }
      setUploading(false)
    }
    reader.readAsDataURL(file)
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
      body: JSON.stringify({ username, bio, profile_image: profileImage }),
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

  const displayName = session?.user?.name || ""
  const initials = displayName.charAt(0).toUpperCase()

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-lg mx-auto px-6 py-12">
        <div className="flex items-center gap-4 mb-8">
          <div className="relative">
            {profileImage ? (
              <img src={profileImage} className="w-16 h-16 rounded-full object-cover"/>
            ) : (
              <div className="w-16 h-16 rounded-full bg-orange-500 flex items-center justify-center text-white text-2xl font-medium">
                {initials}
              </div>
            )}
          </div>
          <div>
            <h1 className="text-xl font-medium">{session?.user?.name}</h1>
            <p className="text-sm text-gray-400">{session?.user?.email}</p>
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-6">
          <h2 className="text-lg font-medium mb-6">Profile Settings</h2>

          <div className="mb-6">
            <label className="text-sm text-gray-500 mb-2 block">Profile photo</label>
            <div className="flex items-center gap-4">
              <div className="relative">
                {profileImage ? (
                  <img src={profileImage} className="w-20 h-20 rounded-full object-cover"/>
                ) : (
                  <div className="w-20 h-20 rounded-full bg-orange-500 flex items-center justify-center text-white text-3xl font-medium">
                    {initials}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => document.getElementById("profile-photo-upload")?.click()}
                  disabled={uploading}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                  {uploading ? "Uploading..." : "Upload photo"}
                </button>
                {profileImage && (
                  <button
                    onClick={() => setProfileImage("")}
                    className="px-4 py-2 border border-red-200 rounded-lg text-sm text-red-400 hover:bg-red-50">
                    Remove photo
                  </button>
                )}
                <input type="file" id="profile-photo-upload" accept="image/*" onChange={uploadProfilePhoto} className="hidden"/>
              </div>
            </div>
          </div>

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
            <div className="mt-4 p-3 bg-gray-50 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 mb-1">Your public profile</p>
                <a href={`/u/${username}`} target="_blank" className="text-sm text-orange-500">
                  smartflavr.com/u/{username} ↗
                </a>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/u/${username}`)
                  setSuccess("Link copied!")
                }}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-500 hover:bg-gray-50">
                Copy link
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}