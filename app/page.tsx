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
      title: "Paste a link. Get a clean recipe.",
      desc: "Any recipe website — paste the URL and SmartFlavr strips out the clutter. Just the ingredients and steps, no ads, no life story before the recipe.",
    },
    {
      icon: "📖",
      title: "Build beautiful cookbooks.",
      desc: "Create themed collections for weeknight dinners, holiday baking, or whatever your family loves most. Add cover photos, sort by category, make it feel like yours.",
    },
    {
      icon: "👨‍🍳",
      title: "Cook mode keeps you on track.",
      desc: "Step through the recipe one instruction at a time, check off ingredients as you use them, and keep your screen awake. Built for messy hands in a real kitchen.",
    },
    {
      icon: "🔗",
      title: "Share with anyone, instantly.",
      desc: "Make a cookbook public and share one link — no app required to view it. Send family recipes, swap ideas with friends, or show off your collection.",
    },
    {
      icon: "🤖",
      title: "AI that actually helps you cook.",
      desc: "Tell it what's in your fridge, what you're craving, or who you're cooking for. It suggests recipes from your own cookbooks and helps you plan the week.",
    },
    {
      icon: "✏️",
      title: "Edit recipes to match how you cook.",
      desc: "Added more garlic? Swapped the oil? Save your version so next time it's already perfect. Your tweaks, stored forever.",
    },
  ]

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-4 border-b border-orange-100/60 relative z-20 bg-white/80 backdrop-blur-sm">
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
      <div className="relative px-6 pt-16 pb-28 text-center overflow-hidden">

        {/* Animated shifting gradient base */}
        <div
          className="absolute inset-0 pointer-events-none animate-gradient-shift"
          style={{
            background: "linear-gradient(135deg, #ffffff 0%, #fff7ed 25%, #ffedd5 50%, #fff7ed 75%, #ffffff 100%)",
            backgroundSize: "300% 300%",
          }}
        />

        {/* Focused glow spots that drift around */}
        <div
          className="absolute pointer-events-none animate-float"
          style={{
            width: "420px", height: "420px",
            top: "-80px", right: "5%",
            background: "radial-gradient(circle, rgba(249,115,22,0.28) 0%, rgba(251,146,60,0.10) 50%, transparent 70%)",
          }}
        />
        <div
          className="absolute pointer-events-none animate-float-slow"
          style={{
            width: "380px", height: "380px",
            bottom: "-60px", left: "8%",
            background: "radial-gradient(circle, rgba(253,186,116,0.32) 0%, rgba(249,115,22,0.10) 50%, transparent 70%)",
            animationDelay: "3s",
          }}
        />
        <div
          className="absolute pointer-events-none animate-float"
          style={{
            width: "300px", height: "300px",
            top: "30%", left: "-40px",
            background: "radial-gradient(circle, rgba(254,215,170,0.35) 0%, transparent 65%)",
            animationDelay: "1.5s",
          }}
        />

        <div className="relative max-w-3xl mx-auto z-10">
          <div
            className="inline-block bg-orange-100 text-orange-600 text-xs font-semibold px-4 py-1.5 rounded-full mb-8 animate-fade-up"
            style={{ animationDelay: "0s" }}>
            🧑‍🍳 Private beta — invite only
          </div>

          <h1
            className="text-5xl sm:text-6xl font-bold leading-[1.1] mb-6 text-gray-900 animate-fade-up"
            style={{ animationDelay: "0.1s", opacity: 0 }}>
            Stop losing<br />recipes you love.<br />
            <span className="text-orange-500">Start cooking smarter.</span>
          </h1>

          <p
            className="text-gray-500 text-lg mb-10 max-w-lg mx-auto leading-relaxed animate-fade-up"
            style={{ animationDelay: "0.2s", opacity: 0 }}>
            Paste any recipe link and SmartFlavr pulls it in clean — no ads, no noise. Build beautiful cookbooks, cook step by step, and share with the people you feed.
          </p>

          {/* CTA area */}
          <div
            className="flex flex-col items-center gap-3 animate-fade-up"
            style={{ animationDelay: "0.3s", opacity: 0 }}>
            {!showInvite ? (
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => setShowInvite(true)}
                  className="px-7 py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 active:scale-95 transition-all text-sm shadow-md shadow-orange-200">
                  Create account
                </button>
                <button
                  onClick={() => {
                    const redirect = new URLSearchParams(window.location.search).get("redirect") || ""
                    router.push(`/login?code=returning${redirect ? `&redirect=${redirect}` : ""}`)
                  }}
                  className="px-7 py-3 border border-gray-200 bg-white text-gray-600 rounded-xl font-medium hover:bg-gray-50 active:scale-95 transition-all text-sm">
                  Sign in
                </button>
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-2xl p-5 w-full max-w-xs text-left shadow-md">
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
            Everything you need to cook smarter.
          </h2>
          <p className="text-center text-gray-400 mb-12 text-base">No fluff. Just the tools that actually matter.</p>
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
            Up and running in under 2 minutes.
          </h2>
          <p className="text-center text-gray-400 mb-12 text-base">Seriously, that's all it takes.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {[
              { n: "1", title: "Get an invite", desc: "Ask someone who's already cooking with SmartFlavr." },
              { n: "2", title: "Sign up instantly", desc: "Enter your code and sign in with Google. Done in 30 seconds." },
              { n: "3", title: "Save a recipe", desc: "Paste any URL — AI pulls the recipe in clean, instantly." },
              { n: "4", title: "Cook and share", desc: "Use cook mode tonight. Share your cookbook tomorrow." },
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
      <div className="relative bg-orange-500 py-16 px-6 text-center text-white overflow-hidden">
        <div className="absolute -top-10 -right-10 w-64 h-64 bg-orange-400 rounded-full blur-3xl opacity-40 pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-orange-600 rounded-full blur-3xl opacity-30 pointer-events-none" />
        <div className="relative z-10">
          <h2 className="text-3xl font-bold mb-3">Got an invite code?</h2>
          <p className="text-orange-100 mb-8 text-base max-w-xs mx-auto">
            Join the people already cooking smarter.
          </p>
          <button
            onClick={() => {
              window.scrollTo({ top: 0, behavior: "smooth" })
              setTimeout(() => setShowInvite(true), 400)
            }}
            className="px-8 py-3 bg-white text-orange-500 rounded-xl font-bold hover:bg-orange-50 active:scale-95 transition-all text-sm shadow-md">
            Create your account
          </button>
        </div>
      </div>

      <div className="border-t border-gray-100 py-6 text-center">
        <p className="text-xs text-gray-400">© 2026 SmartFlavr · Private beta</p>
      </div>
    </div>
  )
}
