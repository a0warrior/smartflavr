import Link from "next/link"
import Image from "next/image"

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-10 rounded-2xl border border-gray-100 w-full max-w-md text-center">
        <div className="flex justify-center mb-4">
          <Image src="/logo.svg" alt="SmartFlavr" width={60} height={60}/>
        </div>
        <h1 className="text-xl font-medium mb-2">You need an invite code</h1>
        <p className="text-sm text-gray-400 mb-6">SmartFlavr is currently invite-only. Ask a friend for a code to get started!</p>
        <Link href="/" className="inline-block bg-orange-500 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-orange-600 transition">
          Enter invite code
        </Link>
      </div>
    </div>
  )
}