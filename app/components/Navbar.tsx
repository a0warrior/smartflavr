"use client"
import { signOut, useSession } from "next-auth/react"
import Link from "next/link"
import Image from "next/image"
import { useState, useEffect } from "react"

export default function Navbar() {
  const { data: session } = useSession()
  const [showMenu, setShowMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [username, setUsername] = useState("")
  const [profileImage, setProfileImage] = useState("")
  const [isAdmin, setIsAdmin] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (session?.user?.email) {
      fetch("/api/profile")
        .then(res => res.json())
        .then(data => {
          if (data.user?.username) setUsername(data.user.username)
          if (data.user?.profile_image) setProfileImage(data.user.profile_image)
          if (data.user?.is_admin) setIsAdmin(data.user.is_admin === 1)
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

  async function fetchNotifications() {
    const res = await fetch("/api/notifications")
    const data = await res.json()
    setNotifications(data.notifications || [])
    setUnreadCount(data.unreadCount || 0)
  }

  async function markAllRead() {
    await fetch("/api/notifications", { method: "PUT" })
    setUnreadCount(0)
    setNotifications(prev => prev.map(n => ({ ...n, read_at: new Date().toISOString() })))
  }

  async function respondToInvite(notification: any, action: "accept" | "decline") {
    const data = typeof notification.data === "string" ? JSON.parse(notification.data) : notification.data
    await fetch("/api/notifications/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        notification_id: notification.id,
        cookbook_id: data.cookbook_id,
        action,
      }),
    })
    fetchNotifications()
    if (action === "accept") {
      window.location.reload()
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

  const initials = session?.user?.name?.charAt(0).toUpperCase() || "?"

  return (
    <nav className="bg-white border-b border-gray-100 px-6 py-2 flex items-center justify-between">
      <Link href="/dashboard" className="flex items-center gap-1">
        <Image src="/logo.svg" alt="SmartFlavr" width={80} height={80}/>
        <span className="text-xl font-medium text-gray-900">Smart<span className="text-orange-500">Flavr</span></span>
      </Link>
      <div className="flex items-center gap-6 relative">
        <Link href="/feed" className="text-sm text-gray-500 hover:text-gray-900 transition">
          Feed
        </Link>
        <Link href="/explore" className="text-sm text-gray-500 hover:text-gray-900 transition">
          Explore
        </Link>
        <Link href="/meal-planner" className="text-sm text-gray-500 hover:text-gray-900 transition">
          Meal Plan
        </Link>

        <div className="relative">
          <button
            onClick={() => {
              setShowNotifications(!showNotifications)
              setShowMenu(false)
            }}
            className="relative text-gray-500 hover:text-gray-900 transition">
            <span className="text-xl">🔔</span>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 top-10 bg-white border border-gray-100 rounded-2xl shadow-lg w-80 z-50 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
                <h3 className="text-sm font-medium">Notifications</h3>
                {unreadCount > 0 && (
                  <button onClick={markAllRead} className="text-xs text-orange-500 hover:text-orange-600">
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-96 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-gray-400">
                    No notifications yet
                  </div>
                ) : (
                  notifications.map((n: any) => {
                    const data = typeof n.data === "string" ? JSON.parse(n.data) : n.data
                    return (
                      <div key={n.id} className={`px-4 py-3 border-b border-gray-50 ${!n.read_at ? "bg-orange-50" : ""}`}>
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm text-gray-700 flex-1">{n.message}</p>
                          <button
                            onClick={() => deleteNotification(n.id)}
                            className="text-xs text-gray-300 hover:text-red-400 flex-shrink-0">
                            ✕
                          </button>
                        </div>
                        {n.type === "collab_invite" && !n.read_at && (
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => respondToInvite(n, "accept")}
                              className="flex-1 bg-orange-500 text-white rounded-lg py-1 text-xs font-medium hover:bg-orange-600">
                              Accept
                            </button>
                            <button
                              onClick={() => respondToInvite(n, "decline")}
                              className="flex-1 border border-gray-200 text-gray-500 rounded-lg py-1 text-xs hover:bg-gray-50">
                              Decline
                            </button>
                          </div>
                        )}
                        {n.type === "collab_invite" && n.read_at && (
                          <p className="text-xs text-gray-400 mt-1 italic">✓ Responded</p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          {new Date(n.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}
        </div>

        <span className="text-sm text-gray-600">{session?.user?.name}</span>
        <div className="relative">
          <button onClick={() => { setShowMenu(!showMenu); setShowNotifications(false) }}>
            {profileImage ? (
              <img src={profileImage} width={32} height={32} className="rounded-full cursor-pointer object-cover"/>
            ) : (
              <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white text-sm font-medium cursor-pointer">
                {initials}
              </div>
            )}
          </button>
          {showMenu && (
            <div className="absolute right-0 top-10 bg-white border border-gray-100 rounded-xl shadow-sm w-48 z-50 py-1">
              {username && (
                <Link
                  href={`/u/${username}`}
                  onClick={() => setShowMenu(false)}
                  className="block px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                  Profile
                </Link>
              )}
              <Link
                href="/feed"
                onClick={() => setShowMenu(false)}
                className="block px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                Feed
              </Link>
              <Link
                href="/explore"
                onClick={() => setShowMenu(false)}
                className="block px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                Explore
              </Link>
              <Link
                href="/meal-planner"
                onClick={() => setShowMenu(false)}
                className="block px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                Meal Plan
              </Link>
              <Link
                href="/profile/settings"
                onClick={() => setShowMenu(false)}
                className="block px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                Settings
              </Link>
              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setShowMenu(false)}
                  className="block px-4 py-2 text-sm text-orange-500 font-medium hover:bg-gray-50">
                  Admin Panel
                </Link>
              )}
              <div className="border-t border-gray-100 my-1"/>
              <button
                onClick={() => signOut({ callbackUrl: "/login?code=returning" })}
                className="block w-full text-left px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}