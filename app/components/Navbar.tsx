"use client"
import { signOut, useSession } from "next-auth/react"
import Link from "next/link"
import Image from "next/image"
import { useState, useEffect } from "react"

export default function Navbar() {
  const { data: session } = useSession()
  const [showMenu, setShowMenu] = useState(false)
  const [username, setUsername] = useState("")
  const [profileImage, setProfileImage] = useState("")
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    if (session?.user?.email) {
      fetch("/api/profile")
        .then(res => res.json())
        .then(data => {
          if (data.user?.username) setUsername(data.user.username)
          if (data.user?.profile_image) setProfileImage(data.user.profile_image)
          if (data.user?.is_admin) setIsAdmin(data.user.is_admin === 1)
        })
    }
  }, [session])

  const initials = session?.user?.name?.charAt(0).toUpperCase() || "?"

  return (
    <nav className="bg-white border-b border-gray-100 px-6 py-2 flex items-center justify-between">
      <Link href="/dashboard" className="flex items-center gap-1">
        <Image src="/logo.svg" alt="SmartFlavr" width={80} height={80}/>
        <span className="text-xl font-medium text-gray-900">Smart<span className="text-orange-500">Flavr</span></span>
      </Link>
      <div className="flex items-center gap-6 relative">
        <Link href="/explore" className="text-sm text-gray-500 hover:text-gray-900 transition">
          Explore
        </Link>
        <span className="text-sm text-gray-600">{session?.user?.name}</span>
        <div className="relative">
          <button onClick={() => setShowMenu(!showMenu)}>
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
                href="/explore"
                onClick={() => setShowMenu(false)}
                className="block px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                Explore
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