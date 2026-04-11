"use client"
import { signIn } from "next-auth/react"

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-10 rounded-2xl shadow-sm border border-gray-100 w-full max-w-md text-center">
        <h1 className="text-3xl font-medium text-gray-900 mb-2">SmartFlavr</h1>
        <p className="text-gray-500 mb-8">Your AI-powered recipe cookbook</p>
        <button
          onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
          className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 rounded-xl px-6 py-3 text-gray-700 font-medium hover:bg-gray-50 transition"
        >
          Sign in with Google
        </button>
      </div>
    </div>
  )
}