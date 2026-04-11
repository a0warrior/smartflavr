"use client"
import { signOut, useSession } from "next-auth/react"
import Link from "next/link"
import Image from "next/image"

export default function Navbar() {
  const { data: session } = useSession()

  return (
    <nav className="bg-white border-b border-gray-100 px-6 py-2 flex items-center justify-between">
      <Link href="/dashboard" className="flex items-center gap-1">
        <Image src="/logo.svg" alt="SmartFlavr" width={70} height={70} />
        <span className="text-xl font-medium text-gray-900">Smart<span className="text-orange-500">Flavr</span></span>
      </Link>
      <div className="flex items-center gap-4">
        {session?.user?.image && (
          <img
            src={session.user.image}
            width={32}
            height={32}
            className="rounded-full"
          />
        )}
        <span className="text-sm text-gray-600">{session?.user?.name}</span>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-sm text-gray-500 hover:text-gray-900 transition"
        >
          Sign out
        </button>
      </div>
    </nav>
  )
}