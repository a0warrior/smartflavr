"use client"
import { signOut, useSession } from "next-auth/react"
import Link from "next/link"
import Image from "next/image"
import { useState, useEffect } from "react"
import { BellIcon, HeartIcon, UserIcon, CommentIcon, BookIcon, BanIcon, WarningIcon, SparkleIcon, PeopleIcon } from "@/app/components/Icons"
import BottomNav from "@/app/components/BottomNav"
import { pulse, subscribe } from "@/lib/firebase"

const navLinks = [
  { href: "/feed", label: "Feed" },
  { href: "/explore", label: "Explore" },
  { href: "/favorites", label: "Favorites" },
  { href: "/inventory", label: "Inventory" },
  { href: "/meal-planner", label: "Meal Plan" },
]

export default function Navbar() {
  const { data: session } = useSession()
  const [showMenu, setShowMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showSidebar, setShowSidebar] = useState(false)
  const [bellRinging, setBellRinging] = useState(false)
  const [username, setUsername] = useState("")
  const [profileImage, setProfileImage] = useState("")
  const [isAdmin, setIsAdmin] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [confirmClearAll, setConfirmClearAll] = useState(false)
  const [userId, setUserId] = useState<number | null>(null)

  useEffect(() => {
    if (session?.user?.email) {
      fetch("/api/profile")
        .then(res => res.json())
        .then(data => {
          if (data.user?.username) setUsername(data.user.username)
          if (data.user?.profile_image) setProfileImage(data.user.profile_image)
          if (data.user?.is_admin) setIsAdmin(data.user.is_admin === 1)
          if (data.user?.id) setUserId(data.user.id)
        })
      fetchNotifications()
    }
  }, [session])

  useEffect(() => {
    const interval = setInterval(() => {
      if (session?.user?.email) fetchNotifications()
    }, 30000)
    return () => clearInterval(interval)
  }, [session])

  useEffect(() => {
    if (!userId) return
    return subscribe(`/updates/users/${userId}/notifications`, fetchNotifications)
  }, [userId])

  async function fetchNotifications() {
    const res = await fetch("/api/notifications")
    const data = await res.json()
    setNotifications(data.notifications || [])
    setUnreadCount(data.unreadCount || 0)
  }

  async function markAllRead() {
    await fetch("/api/notifications", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) })
    setUnreadCount(0)
    setNotifications(prev => prev.map(n => ({ ...n, read_at: new Date().toISOString() })))
  }

  async function markOneRead(id: number) {
    await fetch("/api/notifications", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) })
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  async function respondToInvite(notification: any, action: "accept" | "decline") {
    const res = await fetch("/api/notifications/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notification_id: notification.id, action }),
    })
    const result = await res.json()
    if (result.revoked) {
      fetchNotifications()
      return
    }
    // Let the inviter's open collaborator modal update in real time
    try {
      const data = typeof notification.data === "string" ? JSON.parse(notification.data) : (notification.data || {})
      if (notification.type === "collab_invite" && data.cookbook_id) pulse(`/updates/collabs/cookbook/${data.cookbook_id}`)
      if (notification.type === "grocery_invite" && data.list_id) pulse(`/updates/collabs/grocery/${data.list_id}`)
      if (notification.type === "meal_plan_invite" && data.owner_user_id) pulse(`/updates/collabs/mealplan/${data.owner_user_id}`)
    } catch {}
    if (action === "accept") {
      window.location.href = notification.type === "meal_plan_invite" ? "/meal-planner" : "/dashboard"
    } else {
      fetchNotifications()
    }
  }

  async function deleteNotification(id: number) {
    await fetch("/api/notifications", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
    setNotifications(prev => prev.filter(n => n.id !== id))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  async function clearAllNotifications() {
    await fetch("/api/notifications", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) })
    setNotifications([])
    setUnreadCount(0)
    setConfirmClearAll(false)
  }

  function timeAgo(date: string) {
    const diff = Date.now() - new Date(date).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return "just now"
    if (m < 60) return `${m}m ago`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h ago`
    const d = Math.floor(h / 24)
    if (d < 7) return `${d}d ago`
    return new Date(date).toLocaleDateString()
  }

  function notificationMeta(n: any, nData: any) {
    switch (n.type) {
      case "new_follower":   return { icon: <UserIcon size={16} />,    link: nData.follower_username   ? `/u/${nData.follower_username}`   : null, rowBg: !n.read_at ? "bg-orange-50/60" : "" }
      case "post_like":      return { icon: <HeartIcon filled size={16} />, link: nData.liker_username ? `/u/${nData.liker_username}`      : null, rowBg: !n.read_at ? "bg-orange-50/60" : "" }
      case "post_comment":   return { icon: <CommentIcon size={16} />, link: nData.commenter_username  ? `/u/${nData.commenter_username}`  : null, rowBg: !n.read_at ? "bg-orange-50/60" : "" }
      case "collab_invite":  return { icon: <BookIcon size={16} />,    link: null, rowBg: !n.read_at ? "bg-orange-50/60" : "" }
      case "post_removed":   return { icon: <BanIcon size={16} />,     link: null, rowBg: "bg-red-50" }
      case "content_warning_added": return { icon: <WarningIcon size={16} />, link: null, rowBg: "bg-yellow-50" }
      case "plan_granted":   return { icon: <SparkleIcon size={16} />, link: "/profile/settings?tab=plan", rowBg: !n.read_at ? "bg-orange-50/60" : "" }
      default:               return { icon: <BellIcon size={16} />,    link: null, rowBg: !n.read_at ? "bg-orange-50/60" : "" }
    }
  }

  function handleBellClick() {
    if (!showNotifications) {
      setBellRinging(true)
      setTimeout(() => setBellRinging(false), 700)
    }
    setShowNotifications(prev => !prev)
    setShowMenu(false)
  }

  const initials = session?.user?.name?.charAt(0).toUpperCase() || "?"

  function Avatar({ size = 32 }: { size?: number }) {
    return profileImage ? (
      <img src={profileImage} width={size} height={size} className="rounded-full object-cover ring-2 ring-gray-500" style={{ width: size, height: size }} />
    ) : (
      <div className="rounded-full bg-orange-500 flex items-center justify-center text-white font-medium ring-2 ring-gray-500" style={{ width: size, height: size, fontSize: size * 0.4 }}>
        {initials}
      </div>
    )
  }

  const NotificationDropdown = () => (
    <div className="absolute right-0 top-11 bg-white border border-gray-100 rounded-2xl shadow-xl w-80 z-50 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Notifications</h3>
        {notifications.length > 0 && (
          confirmClearAll ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Clear all?</span>
              <button onClick={clearAllNotifications} className="text-xs text-red-500 hover:text-red-600 font-semibold">Yes</button>
              <button onClick={() => setConfirmClearAll(false)} className="text-xs text-gray-400 hover:text-gray-600">No</button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-xs text-orange-500 hover:text-orange-600 font-medium">Mark all read</button>
              )}
              <button onClick={() => setConfirmClearAll(true)} className="text-xs text-gray-400 hover:text-gray-600 font-medium">Clear all</button>
            </div>
          )
        )}
      </div>
      <div className="max-h-96 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <BellIcon />
            </div>
            <p className="text-sm text-gray-400">You're all caught up</p>
          </div>
        ) : (() => {
          const inviteTypes = ["collab_invite", "grocery_invite", "meal_plan_invite"]
          const priority = notifications.filter((n: any) => inviteTypes.includes(n.type) && !n.read_at)
          const rest = notifications.filter((n: any) => !(inviteTypes.includes(n.type) && !n.read_at))
          return (
            <>
              {priority.length > 0 && (
                <div className="px-3 pt-3 pb-1 space-y-2">
                  <p className="text-[10px] font-semibold text-orange-500 uppercase tracking-wide px-1">Action required</p>
                  {priority.map((n: any) => {
                    return (
                      <div key={n.id} className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-3">
                        <div className="flex items-start gap-2">
                          <div className="flex-shrink-0 mt-0.5 text-orange-500"><BookIcon size={16} /></div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-800 leading-snug">{n.message}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{timeAgo(n.created_at)}</p>
                          </div>
                          <button onClick={() => deleteNotification(n.id)} className="text-gray-300 hover:text-red-400 transition flex-shrink-0 text-xs mt-0.5">✕</button>
                        </div>
                        <div className="flex gap-2 mt-2.5">
                          <button onClick={() => respondToInvite(n, "accept")} className="flex-1 bg-orange-500 text-white rounded-lg py-1.5 text-xs font-semibold hover:bg-orange-600 transition">
                            Accept
                          </button>
                          <button onClick={() => respondToInvite(n, "decline")} className="flex-1 border border-orange-200 text-orange-600 rounded-lg py-1.5 text-xs hover:bg-orange-100 transition">
                            Decline
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              {rest.length > 0 && (
                <div className={`divide-y divide-gray-50 ${priority.length > 0 ? "border-t border-gray-100 mt-2" : ""}`}>
                  {rest.map((n: any) => {
                    const nData = (() => { try { return typeof n.data === "string" ? JSON.parse(n.data) : (n.data || {}) } catch { return {} } })()
                    const { icon, link, rowBg } = notificationMeta(n, nData)
                    return (
                      <div key={n.id} className={`px-4 py-3 ${rowBg}`}>
                        <div className="flex items-start gap-2">
                          <div className="flex-shrink-0 mt-0.5 text-gray-400">{icon}</div>
                          <div className="flex-1 min-w-0">
                            {link ? (
                              <Link href={link} onClick={() => { markOneRead(n.id); setShowNotifications(false) }} className="text-sm text-gray-700 leading-snug hover:text-orange-500 transition block">
                                {n.message}
                              </Link>
                            ) : (
                              <p className="text-sm text-gray-700 leading-snug">{n.message}</p>
                            )}
                            <p className="text-xs text-gray-400 mt-0.5">{timeAgo(n.created_at)}</p>
                          </div>
                          {!n.read_at && <span className="w-2 h-2 rounded-full bg-orange-500 mt-1.5 flex-shrink-0" />}
                          <button onClick={() => deleteNotification(n.id)} className="text-gray-300 hover:text-red-400 transition flex-shrink-0 text-xs mt-0.5">✕</button>
                        </div>
                        {["collab_invite", "grocery_invite", "meal_plan_invite"].includes(n.type) && n.read_at && (
                          <p className="text-xs text-gray-400 mt-1 pl-6 italic">✓ Responded</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )
        })()}
      </div>
    </div>
  )

  return (
    <>
      <nav className="bg-white border-b border-gray-100 px-4 sm:px-6 py-2 flex items-center justify-between relative z-30">
        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-1 flex-shrink-0">
          <Image src="/logo.svg" alt="SmartFlavr" width={80} height={80} />
          <span className="text-xl font-medium text-gray-900">Smart<span className="text-orange-500">Flavr</span></span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-6">
          {navLinks.map(link => (
            <Link key={link.href} href={link.href} className="text-sm text-gray-500 hover:text-gray-900 transition">
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          {/* Bell — visible on all screen sizes */}
          <div className="relative">
            <button
              onClick={handleBellClick}
              className={`relative p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-50 transition ${bellRinging ? "animate-bell-ring" : ""}`}
              style={{ transformOrigin: "top center" }}
            >
              <BellIcon />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold leading-none">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
            {showNotifications && <NotificationDropdown />}
          </div>

          {/* Desktop: avatar + dropdown */}
          <div className="relative hidden md:block">
            <button
              onClick={() => { setShowMenu(prev => !prev); setShowNotifications(false) }}
              className="rounded-full focus:outline-none focus:ring-2 focus:ring-orange-300">
              <Avatar />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-11 bg-white border border-gray-100 rounded-xl shadow-lg w-48 z-50 py-1 overflow-hidden">
                {username && (
                  <Link href={`/u/${username}`} onClick={() => setShowMenu(false)} className="block px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition">
                    View profile
                  </Link>
                )}
                <Link href="/friends" onClick={() => setShowMenu(false)} className="block px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition">
                  Friends
                </Link>
                <Link href="/profile/settings" onClick={() => setShowMenu(false)} className="block px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition">
                  Settings
                </Link>
                {isAdmin && (
                  <Link href="/admin" onClick={() => setShowMenu(false)} className="block px-4 py-2 text-sm text-orange-500 font-medium hover:bg-gray-50 transition">
                    Admin Panel
                  </Link>
                )}
                <div className="border-t border-gray-100 my-1" />
                <button onClick={() => signOut({ callbackUrl: "/" })} className="block w-full text-left px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 transition">
                  Sign out
                </button>
              </div>
            )}
          </div>

          {/* Mobile: hamburger */}
          <button
            onClick={() => { setShowSidebar(true); setShowNotifications(false); setShowMenu(false) }}
            className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-50 transition"
            aria-label="Open menu">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile sidebar backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 z-40 md:hidden transition-opacity duration-300 ${showSidebar ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={() => setShowSidebar(false)}
      />

      {/* Mobile sidebar drawer */}
      <div className={`fixed top-0 right-0 h-full w-72 bg-white z-50 shadow-2xl md:hidden flex flex-col transform transition-transform duration-300 ease-in-out ${showSidebar ? "translate-x-0" : "translate-x-full"}`}>
        {/* Sidebar header: avatar + name + close */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <Link href={username ? `/u/${username}` : "#"} onClick={() => setShowSidebar(false)} className="flex items-center gap-3 min-w-0">
            <Avatar size={40} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{session?.user?.name}</p>
              {username && <p className="text-xs text-gray-400">@{username}</p>}
            </div>
          </Link>
          <button onClick={() => setShowSidebar(false)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-50 transition" aria-label="Close menu">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Sidebar links — account menu only; pages live in the bottom tab bar */}
        <div className="flex-1 overflow-y-auto py-2">
          {username && (
            <Link href={`/u/${username}`} onClick={() => setShowSidebar(false)} className="flex items-center gap-3 px-5 py-3 text-sm text-gray-700 hover:bg-gray-50 transition font-medium">
              <UserIcon size={16} className="text-gray-400" />
              My Profile
            </Link>
          )}
          <Link href="/friends" onClick={() => setShowSidebar(false)} className="flex items-center gap-3 px-5 py-3 text-sm text-gray-700 hover:bg-gray-50 transition font-medium">
            <PeopleIcon size={16} className="text-gray-400" />
            Friends
          </Link>
          <Link href="/favorites" onClick={() => setShowSidebar(false)} className="flex items-center gap-3 px-5 py-3 text-sm text-gray-700 hover:bg-gray-50 transition font-medium">
            <HeartIcon size={16} className="text-gray-400" />
            Favorites
          </Link>
          <div className="border-t border-gray-50 my-1" />
          <Link href="/profile/settings" onClick={() => setShowSidebar(false)} className="flex items-center gap-3 px-5 py-3 text-sm text-gray-600 hover:bg-gray-50 transition">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            Settings
          </Link>
          {isAdmin && (
            <Link href="/admin" onClick={() => setShowSidebar(false)} className="flex items-center px-5 py-3 text-sm text-orange-500 font-semibold hover:bg-gray-50 transition">
              Admin Panel
            </Link>
          )}
        </div>

        {/* Sign out pinned to bottom */}
        <div className="border-t border-gray-100 p-5">
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="w-full text-left text-sm text-red-400 hover:text-red-500 transition font-medium py-1">
            Sign out
          </button>
        </div>
      </div>

      {/* Mobile bottom tab bar */}
      {session && <BottomNav />}
    </>
  )
}
