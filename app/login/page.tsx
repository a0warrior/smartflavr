"use client"
import { signIn } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"
import Image from "next/image"

function LoginContent() {
  const searchParams = useSearchParams()
  const code = searchParams.get("code")
  const [loading, setLoading] = useState(false)

  if (!code) {
    if (typeof window !== "undefined") window.location.href = "/"
    return null
  }

  const isReturning = code === "returning"

  async function handleSignIn() {
    setLoading(true)
    signIn("google", { callbackUrl: `/dashboard?code=${isReturning ? "" : code}` })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-10 rounded-2xl shadow-sm border border-gray-100 w-full max-w-md text-center">
        <div className="flex justify-center mb-4">
          <Image src="/logo.svg" alt="SmartFlavr" width={60} height={60}/>
        </div>
        <h1 className="text-2xl font-medium text-gray-900 mb-1">Welcome to SmartFlavr</h1>
        <p className="text-gray-400 text-sm mb-8">
          {isReturning ? "Welcome back! Sign in to continue." : "Code accepted! Sign in to get started."}
        </p>
        <button
          onClick={handleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 rounded-xl px-6 py-3 text-gray-700 font-medium hover:bg-gray-50 transition">
          <img src="https://www.google.com/favicon.ico" width={18} height={18} alt="Google"/>
          {loading ? "Signing in..." : "Sign in with Google"}
        </button>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}