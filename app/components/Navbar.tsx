"use client"
import { signOut, useSession } from "next-auth/react"
import Link from "next/link"
import Image from "next/image"
import { useState } from "react"

export default function Navbar() {
  const { data: session } = useSession()
  const [showMenu, setShowMenu] = useState(false)

  return (
    <nav className="bg-white border-b border-gray-100 px-6 py-2 flex items-center justify-between">
      <Link href="/dashboard" className="flex items-center gap-1">
        <Image src="/logo.svg" alt="SmartFlavr" width={80} height={80}/>
        <span className="text-xl font-medium text-gray-900">Smart<span className="text-orange-500">Flavr</span></span>
      </Link>
      <div className="flex items-center gap-4 relative">
        <span className="text-sm text-gray-600">{session?.user?.name}</span>
        <div className="relative">
          <button onClick={() => setShowMenu(!showMenu)}>
            {session?.user?.image && (
              <img src={session.user.image} width={32} height={32} className="rounded-full cursor-pointer"/>
            )}
          </button>
          {showMenu && (
            <div className="absolute right-0 top-10 bg-white border border-gray-100 rounded-xl shadow-sm w-48 z-50 py-1">
              <Link
                href="/profile/settings"
                onClick={() => setShowMenu(false)}
                className="block px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                Profile settings
              </Link>
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