"use client"
import { useState } from "react"
import { signIn } from "next-auth/react"
import Image from "next/image"
import { useRouter } from "next/navigation"

export default function HomePage() {
  const router = useRouter()
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [showInvite, setShowInvite] = useState(false)

  function formatCode(val: string) {
    const clean = val.replace(/[^A-Za-z0-9]/g, "").toUpperCase()
    if (clean.length > 4) return clean.slice(0, 4) + "-" + clean.slice(4, 8)
    return clean
  }

  async function handleCreateAccount() {
    if (code.length < 9) {
      setError("Enter a valid invite code to continue.")
      return
    }
    setLoading(true)
    setError("")
    const res = await fetch("/api/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    })
    const data = await res.json()
    if (data.valid) {
      const redirect = new URLSearchParams(window.location.search).get("redirect") || "/dashboard"
      signIn("google", { callbackUrl: `${redirect}?code=${code}` })
    } else {
      setError("That code isn't valid. Check with whoever invited you.")
      setLoading(false)
    }
  }

  const features = [
    {
      icon: "✦",
      title: "Paste a link. Get a recipe.",
      desc: "Found something you want to try? Drop in the URL — our AI pulls every ingredient and step automatically. No more retyping things.",
    },
    {
      icon: "📖",
      title: "Build your cookbook.",
      desc: "Organize everything into beautiful digital cookbooks. Add photos, write notes, group by category. Make it look as good as it tastes.",
    },
    {
      icon: "👨‍🍳",
      title: "Actually cook from it.",
      desc: "Cook mode walks you through each step with ingredient checkboxes. Your phone stays on, your hands get covered in flour.",
    },
    {
      icon: "🔗",
      title: "Share with people you love.",
      desc: "Make your cookbook public and send a link to anyone. Way better than a screenshot in the family group chat.",
    },
    {
      icon: "🤖",
      title: "AI that pulls its weight.",
      desc: "Need inspiration? Ask what you can make with what's in your fridge. Get suggestions based on what you already love.",
    },
    {
      icon: "✏️",
      title: "Fully yours to edit.",
      desc: "Tweak recipes to how you actually make them. Reorder, rename, reorganize — it's your cookbook, after all.",
    },
  ]

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-4 border-b border-gray-100 relative z-10">
        <div className="flex items-center gap-2">
          <Image src="/logo.svg" alt="SmartFlavr" width={32} height={32} />
          <span className="text-lg font-semibold">
            Smart<span className="text-orange-500">Flavr</span>
          </span>
        </div>
        <button
          onClick={() => {
            const redirect = new URLSearchParams(window.location.search).get("redirect") || ""
            router.push(`/login?code=returning${redirect ? `&redirect=${redirect}` : ""}`)
          }}
          className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition">
          Sign in
        </button>
      </nav>

      {/* Hero */}
      <div className="relative px-6 pt-16 pb-24 text-center overflow-hidden">
        {/* Floating background blobs */}
        <div
          className="absolute -top-8 right-0 w-96 h-96 bg-orange-100 rounded-full blur-3xl opacity-50 animate-float pointer-events-none"
          style={{ animationDelay: "0s" }}
        />
        <div
          className="absolute top-32 -left-20 w-80 h-80 bg-orange-50 rounded-full blur-3xl opacity-60 animate-float-slow pointer-events-none"
          style={{ animationDelay: "1.5s" }}
        />
        <div
          className="absolute bottom-0 right-10 w-56 h-56 bg-orange-100 rounded-full blur-2xl opacity-30 animate-float pointer-events-none"
          style={{ animationDelay: "3s" }}
        />

        <div className="relative max-w-3xl mx-auto">
          <div
            className="inline-block bg-orange-50 text-orange-600 text-xs font-semibold px-4 py-1.5 rounded-full mb-8 animate-fade-up"
            style={{ animationDelay: "0s" }}>
            🧑‍🍳 Private beta — invite only
          </div>

          <h1
            className="text-5xl sm:text-6xl font-bold leading-[1.1] mb-6 text-gray-900 animate-fade-up"
            style={{ animationDelay: "0.1s", opacity: 0 }}>
            Your recipes,<br />finally in one<br />
            <span className="text-orange-500">beautiful place.</span>
          </h1>

          <p
            className="text-gray-500 text-lg mb-10 max-w-md mx-auto leading-relaxed animate-fade-up"
            style={{ animationDelay: "0.2s", opacity: 0 }}>
            SmartFlavr turns recipe chaos into a cookbook you'll actually want to use — and keep using.
          </p>

          {/* CTA area */}
          <div
            className="flex flex-col items-center gap-3 animate-fade-up"
            style={{ animationDelay: "0.3s", opacity: 0 }}>
            {!showInvite ? (
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => setShowInvite(true)}
                  className="px-7 py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 active:scale-95 transition-all text-sm shadow-sm shadow-orange-200">
                  Create account
                </button>
                <button
                  onClick={() => {
                    const redirect = new URLSearchParams(window.location.search).get("redirect") || ""
                    router.push(`/login?code=returning${redirect ? `&redirect=${redirect}` : ""}`)
                  }}
                  className="px-7 py-3 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-50 active:scale-95 transition-all text-sm">
                  Sign in
                </button>
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-2xl p-5 w-full max-w-xs text-left shadow-sm">
                <p className="text-sm font-semibold mb-1 text-gray-900">Enter your invite code</p>
                <p className="text-xs text-gray-400 mb-3">Get one from a friend who's already on SmartFlavr.</p>
                <div className="flex gap-2 mb-2">
                  <input
                    autoFocus
                    value={code}
                    onChange={e => setCode(formatCode(e.target.value))}
                    onKeyDown={e => e.key === "Enter" && handleCreateAccount()}
                    placeholder="XXXX-XXXX"
                    maxLength={9}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm tracking-widest outline-none focus:border-orange-400 transition"
                  />
                  <button
                    onClick={handleCreateAccount}
                    disabled={loading}
                    className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-orange-600 transition disabled:opacity-60">
                    {loading ? "..." : "Go"}
                  </button>
                </div>
                {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
                <button
                  onClick={() => { setShowInvite(false); setError(""); setCode("") }}
                  className="text-xs text-gray-400 hover:text-gray-600 mt-2 transition">
                  ← Back
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="bg-gray-50 py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-2 text-gray-900">
            Everything you need, nothing you don't.
          </h2>
          <p className="text-center text-gray-400 mb-12 text-base">We kept it simple on purpose.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {features.map((f, i) => (
              <div
                key={i}
                className="bg-white border border-gray-100 rounded-2xl p-6 hover:-translate-y-1 hover:shadow-md transition-all duration-200 cursor-default group">
                <div className="text-2xl mb-3 group-hover:scale-110 transition-transform duration-200 inline-block">
                  {f.icon}
                </div>
                <div className="text-sm font-semibold mb-2 text-gray-900">{f.title}</div>
                <div className="text-sm text-gray-500 leading-relaxed">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-2 text-gray-900">
            Up and running in 2 minutes.
          </h2>
          <p className="text-center text-gray-400 mb-12 text-base">Seriously, that's all it takes.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {[
              { n: "1", title: "Get an invite", desc: "Ask a friend already in the beta." },
              { n: "2", title: "Create account", desc: "Enter your code and sign in with Google. No password." },
              { n: "3", title: "Add a recipe", desc: "Paste a link and let AI do the work." },
              { n: "4", title: "Start cooking", desc: "Your cookbook is ready to go." },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <div className="w-10 h-10 rounded-full bg-orange-500 text-white text-sm font-bold flex items-center justify-center mx-auto mb-3 shadow-sm shadow-orange-200">
                  {s.n}
                </div>
                <div className="text-sm font-semibold mb-1 text-gray-900">{s.title}</div>
                <div className="text-xs text-gray-500 leading-relaxed">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="bg-orange-500 py-16 px-6 text-center text-white">
        <h2 className="text-3xl font-bold mb-3">Got an invite code?</h2>
        <p className="text-orange-100 mb-8 text-base max-w-xs mx-auto">
          Join the people already cooking smarter.
        </p>
        <button
          onClick={() => {
            window.scrollTo({ top: 0, behavior: "smooth" })
            setTimeout(() => setShowInvite(true), 400)
          }}
          className="px-8 py-3 bg-white text-orange-500 rounded-xl font-bold hover:bg-orange-50 active:scale-95 transition-all text-sm">
          Create your account
        </button>
      </div>

      <div className="border-t border-gray-100 py-6 text-center">
        <p className="text-xs text-gray-400">© 2026 SmartFlavr · Private beta</p>
      </div>
    </div>
  )
}
