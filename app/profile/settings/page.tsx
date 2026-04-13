"use client"
import { useSession, signOut } from "next-auth/react"
import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense } from "react"
import Navbar from "@/app/components/Navbar"

function ProfileSettingsContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const isNew = searchParams.get("new") === "true"
  const [name, setName] = useState("")
  const [username, setUsername] = useState("")
  const [bio, setBio] = useState("")
  const [profileImage, setProfileImage] = useState("")
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login?code=returning")
    if (status === "authenticated") fetchProfile()
  }, [status])

  async function fetchProfile() {
    const res = await fetch("/api/profile")
    const data = await res.json()
    if (data.user) {
      setName(data.user.name || "")
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
      if (data.success) setProfileImage(data.url)
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
    if (!name) {
      setError("Name is required")
      return
    }
    setLoading(true)
    setError("")
    setSuccess("")
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, bio, profile_image: profileImage, name }),
    })
    const data = await res.json()
    if (data.error) {
      setError(data.error)
    } else {
      if (isNew) {
        router.push("/dashboard")
      } else {
        setSuccess("Profile saved!")
      }
    }
    setLoading(false)
  }

  async function deleteAccount() {
    setDeleting(true)
    const res = await fetch("/api/profile", { method: "DELETE" })
    const data = await res.json()
    if (data.success) {
      await signOut({ callbackUrl: "/" })
    } else {
      setError("Failed to delete account. Please try again.")
      setDeleting(false)
      setShowDeleteModal(false)
    }
  }

  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  const initials = name.charAt(0).toUpperCase() || session?.user?.name?.charAt(0).toUpperCase() || "?"

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-lg mx-auto px-6 py-12">
        <div className="flex items-center gap-4 mb-8">
          {profileImage ? (
            <img src={profileImage} className="w-16 h-16 rounded-full object-cover"/>
          ) : (
            <div className="w-16 h-16 rounded-full bg-orange-500 flex items-center justify-center text-white text-2xl font-medium">
              {initials}
            </div>
          )}
          <div>
            <h1 className="text-xl font-medium">{name || session?.user?.name}</h1>
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-4">
          <h2 className="text-lg font-medium mb-2">
            {isNew ? "Welcome to SmartFlavr! 🎉" : "Profile Settings"}
          </h2>
          {isNew && (
            <p className="text-sm text-gray-500 mb-6">Set up your profile to get started.</p>
          )}

          <div className="mb-6">
            <label className="text-sm text-gray-500 mb-2 block">Profile photo</label>
            <div className="flex items-center gap-4">
              {profileImage ? (
                <img src={profileImage} className="w-20 h-20 rounded-full object-cover"/>
              ) : (
                <div className="w-20 h-20 rounded-full bg-orange-500 flex items-center justify-center text-white text-3xl font-medium">
                  {initials}
                </div>
              )}
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
            <label className="text-sm text-gray-500 mb-1 block">Display name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your name"
              className="border border-gray-200 rounded-lg px-3 py-2 w-full text-sm outline-none"
            />
          </div>

          <div className="mb-4">
            <label className="text-sm text-gray-500 mb-1 block">Email</label>
            <input
              value={session?.user?.email || ""}
              disabled
              className="border border-gray-100 rounded-lg px-3 py-2 w-full text-sm bg-gray-50 text-gray-400 cursor-not-allowed"
            />
            <p className="text-xs text-gray-400 mt-1">Email is tied to your Google account and cannot be changed here.</p>
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
            {!isNew && (
              <button onClick={() => router.push("/dashboard")} className="flex-1 border border-gray-200 rounded-xl py-2 text-sm text-gray-500 hover:bg-gray-50">
                Cancel
              </button>
            )}
            <button onClick={saveProfile} disabled={loading} className="flex-1 bg-orange-500 text-white rounded-xl py-2 text-sm font-medium hover:bg-orange-600">
              {loading ? "Saving..." : isNew ? "Get started →" : "Save profile"}
            </button>
          </div>

          {!isNew && username && (
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

        {!isNew && (
          <div className="bg-white border border-red-100 rounded-2xl p-6">
            <h2 className="text-sm font-medium text-red-500 mb-1">Danger Zone</h2>
            <p className="text-xs text-gray-400 mb-4">Permanently delete your account and all your data including cookbooks, recipes, and posts. This cannot be undone.</p>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="px-4 py-2 border border-red-200 text-red-400 rounded-xl text-sm hover:bg-red-50 transition">
              Delete my account
            </button>
          </div>
        )}
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4">
            <div className="text-3xl mb-3 text-center">⚠️</div>
            <h2 className="text-lg font-medium text-center mb-2">Delete your account?</h2>
            <p className="text-sm text-gray-500 text-center mb-1">This will permanently delete:</p>
            <ul className="text-sm text-gray-500 mb-6 space-y-1 text-center">
              <li>All your cookbooks and recipes</li>
              <li>All your posts and comments</li>
              <li>Your profile and followers</li>
            </ul>
            <p className="text-sm font-medium text-red-500 text-center mb-6">This cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 border border-gray-200 rounded-xl py-2 text-sm text-gray-500 hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={deleteAccount}
                disabled={deleting}
                className="flex-1 bg-red-500 text-white rounded-xl py-2 text-sm font-medium hover:bg-red-600">
                {deleting ? "Deleting..." : "Yes, delete everything"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ProfileSettings() {
  return (
    <Suspense>
      <ProfileSettingsContent />
    </Suspense>
  )
}