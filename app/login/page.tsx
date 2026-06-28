"use client"
import { signIn } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"
import Image from "next/image"
import Link from "next/link"

function LoginContent() {
  const searchParams = useSearchParams()
  const code = searchParams.get("code")
  const redirect = searchParams.get("redirect") || "/dashboard"
  const [loading, setLoading] = useState(false)

  if (!code) {
    if (typeof window !== "undefined") window.location.href = "/"
    return null
  }

  const isReturning = code === "returning"

  async function handleSignIn() {
    setLoading(true)
    signIn("google", { callbackUrl: redirect })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white p-10 rounded-2xl shadow-sm border border-gray-100 w-full max-w-md text-center">
        <div className="flex justify-center mb-5">
          <Image src="/logo.svg" alt="SmartFlavr" width={56} height={56} />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          {isReturning ? "Welcome back." : "You're in."}
        </h1>
        <p className="text-gray-400 text-sm mb-8">
          {isReturning
            ? "Sign in to continue where you left off."
            : "Code accepted — sign in with Google to finish creating your account."}
        </p>
        <button
          onClick={handleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-white border border-gray-200 rounded-xl px-6 py-3 text-gray-700 font-medium hover:bg-gray-50 active:scale-95 transition-all">
          <img src="https://www.google.com/favicon.ico" width={18} height={18} alt="Google" />
          {loading ? "Signing in..." : "Sign in with Google"}
        </button>
        {isReturning && (
          <p className="text-xs text-gray-400 mt-6">
            New here?{" "}
            <Link href="/" className="text-orange-500 hover:underline font-medium">
              Create an account
            </Link>
          </p>
        )}
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
