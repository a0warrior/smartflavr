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
  const [activeTab, setActiveTab] = useState<"profile" | "privacy">("profile")

  // Profile state
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

  // Privacy state
  const [profileVisibility, setProfileVisibility] = useState("everyone")
  const [cookbookVisibility, setCookbookVisibility] = useState("everyone")
  const [showOnExplore, setShowOnExplore] = useState(true)
  const [whoCanFollow, setWhoCanFollow] = useState("anyone")
  const [whoCanCollab, setWhoCanCollab] = useState("friends")
  const [showFollowerCount, setShowFollowerCount] = useState(true)
  const [notifyNewFollower, setNotifyNewFollower] = useState(true)
  const [notifyCollabInvite, setNotifyCollabInvite] = useState(true)
  const [notifyNewRecipe, setNotifyNewRecipe] = useState(false)
  const [notifyCollabRemoved, setNotifyCollabRemoved] = useState(true)
  const [showRecentRecipes, setShowRecentRecipes] = useState(true)
  const [showFavorites, setShowFavorites] = useState(false)
  const [appearInSuggestions, setAppearInSuggestions] = useState(true)
  const [privacySaving, setPrivacySaving] = useState(false)
  const [privacySuccess, setPrivacySuccess] = useState("")

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
      if (data.user.privacy) {
        const p = data.user.privacy
        setProfileVisibility(p.profile_visibility || "everyone")
        setCookbookVisibility(p.cookbook_visibility || "everyone")
        setShowOnExplore(p.show_on_explore ?? true)
        setWhoCanFollow(p.who_can_follow || "anyone")
        setWhoCanCollab(p.who_can_collab || "friends")
        setShowFollowerCount(p.show_follower_count ?? true)
        setNotifyNewFollower(p.notify_new_follower ?? true)
        setNotifyCollabInvite(p.notify_collab_invite ?? true)
        setNotifyNewRecipe(p.notify_new_recipe ?? false)
        setNotifyCollabRemoved(p.notify_collab_removed ?? true)
        setShowRecentRecipes(p.show_recent_recipes ?? true)
        setShowFavorites(p.show_favorites ?? false)
        setAppearInSuggestions(p.appear_in_suggestions ?? true)
      }
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
    if (!username) { setError("Username is required"); return }
    if (username.includes(" ")) { setError("Username cannot contain spaces"); return }
    if (!name) { setError("Name is required"); return }
    setLoading(true); setError(""); setSuccess("")
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, bio, profile_image: profileImage, name }),
    })
    const data = await res.json()
    if (data.error) {
      setError(data.error)
    } else {
      if (isNew) { router.push("/dashboard") } else { setSuccess("Profile saved!") }
    }
    setLoading(false)
  }

  async function savePrivacy() {
    setPrivacySaving(true); setPrivacySuccess("")
    await fetch("/api/profile/privacy", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profile_visibility: profileVisibility,
        cookbook_visibility: cookbookVisibility,
        show_on_explore: showOnExplore,
        who_can_follow: whoCanFollow,
        who_can_collab: whoCanCollab,
        show_follower_count: showFollowerCount,
        notify_new_follower: notifyNewFollower,
        notify_collab_invite: notifyCollabInvite,
        notify_new_recipe: notifyNewRecipe,
        notify_collab_removed: notifyCollabRemoved,
        show_recent_recipes: showRecentRecipes,
        show_favorites: showFavorites,
        appear_in_suggestions: appearInSuggestions,
      }),
    })
    setPrivacySuccess("Preferences saved!")
    setPrivacySaving(false)
    setTimeout(() => setPrivacySuccess(""), 3000)
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

  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
    <button
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-10 items-center rounded-full transition-colors flex-shrink-0 ${checked ? "bg-orange-500" : "bg-gray-200"}`}>
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? "translate-x-5" : "translate-x-1"}`}/>
    </button>
  )

  const ToggleRow = ({ label, sub, checked, onChange }: any) => (
    <div className="flex items-center justify-between py-4 border-b border-gray-50 last:border-0 gap-4">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900">{label}</div>
        {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  )

  const SelectRow = ({ label, sub, value, onChange, options }: any) => (
    <div className="flex items-center justify-between py-4 border-b border-gray-50 last:border-0 gap-4">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-900">{label}</div>
        {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
      </div>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 outline-none cursor-pointer flex-shrink-0">
        {options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-lg mx-auto px-6 py-12">

        <div className="flex items-center gap-4 mb-6">
          {profileImage ? (
            <img src={profileImage} className="w-16 h-16 rounded-full object-cover"/>
          ) : (
            <div className="w-16 h-16 rounded-full bg-orange-500 flex items-center justify-center text-white text-2xl font-medium">{initials}</div>
          )}
          <div>
            <h1 className="text-xl font-medium">{name || session?.user?.name}</h1>
            {username && <p className="text-sm text-gray-400">@{username}</p>}
          </div>
        </div>

        {!isNew && (
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
            <button
              onClick={() => setActiveTab("profile")}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${activeTab === "profile" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              Profile
            </button>
            <button
              onClick={() => setActiveTab("privacy")}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${activeTab === "privacy" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              Privacy & preferences
            </button>
          </div>
        )}

        {(activeTab === "profile" || isNew) && (
          <>
            <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-4">
              <h2 className="text-lg font-medium mb-2">
                {isNew ? "Welcome to SmartFlavr! 🎉" : "Profile Settings"}
              </h2>
              {isNew && <p className="text-sm text-gray-500 mb-6">Set up your profile to get started.</p>}

              <div className="mb-6">
                <label className="text-sm text-gray-500 mb-2 block">Profile photo</label>
                <div className="flex items-center gap-4">
                  {profileImage ? (
                    <img src={profileImage} className="w-20 h-20 rounded-full object-cover"/>
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-orange-500 flex items-center justify-center text-white text-3xl font-medium">{initials}</div>
                  )}
                  <div className="flex flex-col gap-2">
                    <button onClick={() => document.getElementById("profile-photo-upload")?.click()} disabled={uploading} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                      {uploading ? "Uploading..." : "Upload photo"}
                    </button>
                    {profileImage && (
                      <button onClick={() => setProfileImage("")} className="px-4 py-2 border border-red-200 rounded-lg text-sm text-red-400 hover:bg-red-50">
                        Remove photo
                      </button>
                    )}
                    <input type="file" id="profile-photo-upload" accept="image/*" onChange={uploadProfilePhoto} className="hidden"/>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <label className="text-sm text-gray-500 mb-1 block">Display name</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" className="border border-gray-200 rounded-lg px-3 py-2 w-full text-sm outline-none"/>
              </div>

              <div className="mb-4">
                <label className="text-sm text-gray-500 mb-1 block">Email</label>
                <input value={session?.user?.email || ""} disabled className="border border-gray-100 rounded-lg px-3 py-2 w-full text-sm bg-gray-50 text-gray-400 cursor-not-allowed"/>
                <p className="text-xs text-gray-400 mt-1">Email is tied to your Google account and cannot be changed here.</p>
              </div>

              <div className="mb-4">
                <label className="text-sm text-gray-500 mb-1 block">Username</label>
                <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                  <span className="px-3 py-2 bg-gray-50 text-sm text-gray-400 border-r border-gray-200">smartflavr.com/u/</span>
                  <input value={username} onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} placeholder="yourname" className="flex-1 px-3 py-2 text-sm outline-none"/>
                </div>
                <p className="text-xs text-gray-400 mt-1">Only letters, numbers and underscores</p>
              </div>

              <div className="mb-6">
                <label className="text-sm text-gray-500 mb-1 block">Bio</label>
                <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell people a bit about yourself and your cooking..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none outline-none" rows={3} maxLength={200}/>
                <p className="text-xs text-gray-400 mt-1">{bio.length}/200</p>
              </div>

              {error && <p className="text-sm text-red-500 mb-4">{error}</p>}
              {success && <p className="text-sm text-green-600 mb-4">{success}</p>}

              <div className="flex gap-3">
                {!isNew && (
                  <button onClick={() => router.push("/dashboard")} className="flex-1 border border-gray-200 rounded-xl py-2 text-sm text-gray-500 hover:bg-gray-50">Cancel</button>
                )}
                <button onClick={saveProfile} disabled={loading} className="flex-1 bg-orange-500 text-white rounded-xl py-2 text-sm font-medium hover:bg-orange-600">
                  {loading ? "Saving..." : isNew ? "Get started →" : "Save profile"}
                </button>
              </div>

              {!isNew && username && (
                <div className="mt-4 p-3 bg-gray-50 rounded-xl flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Your public profile</p>
                    <a href={`/u/${username}`} target="_blank" className="text-sm text-orange-500">smartflavr.com/u/{username} ↗</a>
                  </div>
                  <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/u/${username}`); setSuccess("Link copied!") }} className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-500 hover:bg-gray-50">
                    Copy link
                  </button>
                </div>
              )}
            </div>

            {!isNew && (
              <div className="bg-white border border-red-100 rounded-2xl p-6">
                <h2 className="text-sm font-medium text-red-500 mb-1">Danger Zone</h2>
                <p className="text-xs text-gray-400 mb-4">Permanently delete your account and all your data including cookbooks, recipes, and posts. This cannot be undone.</p>
                <button onClick={() => setShowDeleteModal(true)} className="px-4 py-2 border border-red-200 text-red-400 rounded-xl text-sm hover:bg-red-50 transition">
                  Delete my account
                </button>
              </div>
            )}
          </>
        )}

        {activeTab === "privacy" && !isNew && (
          <div className="space-y-4">

            <div className="bg-white border border-gray-100 rounded-2xl px-5 py-2">
              <div className="pt-3 pb-2 border-b border-gray-50">
                <div className="text-sm font-medium text-gray-900">Profile visibility</div>
                <div className="text-xs text-gray-400 mt-0.5">Control who can see your profile and content</div>
              </div>
              <SelectRow label="Who can see my profile" sub="Your name, bio, and profile photo" value={profileVisibility} onChange={setProfileVisibility} options={[{ value: "everyone", label: "Everyone" }, { value: "friends", label: "Friends only" }, { value: "only_me", label: "Only me" }]}/>
              <SelectRow label="Who can see my cookbooks" sub="Applies to cookbooks marked as public" value={cookbookVisibility} onChange={setCookbookVisibility} options={[{ value: "everyone", label: "Everyone" }, { value: "friends", label: "Friends only" }, { value: "only_me", label: "Only me" }]}/>
              <ToggleRow label="Show on Explore page" sub="Let others discover your profile and cookbooks" checked={showOnExplore} onChange={setShowOnExplore}/>
            </div>

            <div className="bg-white border border-gray-100 rounded-2xl px-5 py-2">
              <div className="pt-3 pb-2 border-b border-gray-50">
                <div className="text-sm font-medium text-gray-900">Connections</div>
                <div className="text-xs text-gray-400 mt-0.5">Manage who can follow and interact with you</div>
              </div>
              <SelectRow label="Who can follow me" sub="New follow requests from others" value={whoCanFollow} onChange={setWhoCanFollow} options={[{ value: "anyone", label: "Anyone" }, { value: "no_one", label: "No one" }]}/>
              <SelectRow label="Who can invite me to collaborate" sub="Cookbook collaboration requests" value={whoCanCollab} onChange={setWhoCanCollab} options={[{ value: "friends", label: "Friends only" }, { value: "anyone", label: "Anyone" }, { value: "no_one", label: "No one" }]}/>
              <ToggleRow label="Show my follower count" sub="Display followers and following on your profile" checked={showFollowerCount} onChange={setShowFollowerCount}/>
            </div>

            <div className="bg-white border border-gray-100 rounded-2xl px-5 py-2">
              <div className="pt-3 pb-2 border-b border-gray-50">
                <div className="text-sm font-medium text-gray-900">Notifications</div>
                <div className="text-xs text-gray-400 mt-0.5">Choose what you get notified about</div>
              </div>
              <ToggleRow label="New follower" sub="When someone starts following you" checked={notifyNewFollower} onChange={setNotifyNewFollower}/>
              <ToggleRow label="Collaboration invite" sub="When someone invites you to a cookbook" checked={notifyCollabInvite} onChange={setNotifyCollabInvite}/>
              <ToggleRow label="New recipe from someone you follow" sub="Activity from people in your network" checked={notifyNewRecipe} onChange={setNotifyNewRecipe}/>
              <ToggleRow label="Removed from collaboration" sub="When you are removed from a shared cookbook" checked={notifyCollabRemoved} onChange={setNotifyCollabRemoved}/>
            </div>

            <div className="bg-white border border-gray-100 rounded-2xl px-5 py-2">
              <div className="pt-3 pb-2 border-b border-gray-50">
                <div className="text-sm font-medium text-gray-900">Activity</div>
                <div className="text-xs text-gray-400 mt-0.5">Control what others can see about your activity</div>
              </div>
              <ToggleRow label="Show my recently added recipes" sub="Appears on your public profile" checked={showRecentRecipes} onChange={setShowRecentRecipes}/>
              <ToggleRow label="Show my favorites" sub="Let friends see recipes you've favorited" checked={showFavorites} onChange={setShowFavorites}/>
              <ToggleRow label="Appear in friend suggestions" sub="Show up when others look for people to follow" checked={appearInSuggestions} onChange={setAppearInSuggestions}/>
            </div>

            {privacySuccess && <p className="text-sm text-green-600 text-center">{privacySuccess}</p>}

            <button onClick={savePrivacy} disabled={privacySaving} className="w-full bg-orange-500 text-white rounded-xl py-3 text-sm font-medium hover:bg-orange-600 transition">
              {privacySaving ? "Saving..." : "Save preferences"}
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
              <button onClick={() => setShowDeleteModal(false)} className="flex-1 border border-gray-200 rounded-xl py-2 text-sm text-gray-500 hover:bg-gray-50">Cancel</button>
              <button onClick={deleteAccount} disabled={deleting} className="flex-1 bg-red-500 text-white rounded-xl py-2 text-sm font-medium hover:bg-red-600">
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