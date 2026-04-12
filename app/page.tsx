"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"

export default function HomePage() {
  const router = useRouter()
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  function formatCode(val: string) {
    const clean = val.replace(/[^A-Za-z0-9]/g, "").toUpperCase()
    if (clean.length > 4) return clean.slice(0, 4) + "-" + clean.slice(4, 8)
    return clean
  }

  async function checkCode() {
    if (code.length < 9) {
      setError("Please enter a valid invite code.")
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
      const redirect = new URLSearchParams(window.location.search).get("redirect") || ""
      router.push(`/login?code=${code}${redirect ? `&redirect=${redirect}` : ""}`)
    } else {
      setError("That code isn't valid. Check with whoever invited you.")
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-white">
      <nav className="flex items-center justify-between px-10 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Image src="/logo.svg" alt="SmartFlavr" width={36} height={36}/>
          <span className="text-lg font-medium">Smart<span className="text-orange-500">Flavr</span></span>
        </div>
        <button
          onClick={() => {
            const redirect = new URLSearchParams(window.location.search).get("redirect") || ""
            router.push(`/login?code=returning${redirect ? `&redirect=${redirect}` : ""}`)
          }}
          className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-500 hover:bg-gray-50 transition">
          Sign in
        </button>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <div className="inline-block bg-orange-50 text-orange-700 text-xs font-medium px-4 py-1.5 rounded-full mb-6">
          Now in private beta
        </div>
        <h1 className="text-5xl font-medium leading-tight mb-4">
          Your recipes.<br/>Your <span className="text-orange-500">cookbook.</span><br/>Powered by AI.
        </h1>
        <p className="text-gray-500 text-lg mb-10 leading-relaxed max-w-md mx-auto">
          Build beautiful cookbooks, extract recipes from any URL, organize by category, and share with friends and family.
        </p>

        <div id="invite-box" className="bg-white border border-gray-200 rounded-2xl p-6 max-w-sm mx-auto mb-12">
          <p className="text-sm font-medium mb-3">Enter your invite code to get started</p>
          <div className="flex gap-2 mb-2">
            <input
              value={code}
              onChange={e => setCode(formatCode(e.target.value))}
              onKeyDown={e => e.key === "Enter" && checkCode()}
              placeholder="XXXX-XXXX"
              maxLength={9}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm tracking-widest outline-none focus:border-orange-300"
            />
            <button
              onClick={checkCode}
              disabled={loading}
              className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 transition">
              {loading ? "..." : "Continue"}
            </button>
          </div>
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          <p className="text-xs text-gray-400 mt-2">Don't have a code? Ask a friend who's already on SmartFlavr.</p>
        </div>
      </div>

      <div className="bg-gray-50 py-16 px-6">
        <h2 className="text-2xl font-medium text-center mb-10">Everything you need to cook smarter</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4" style={{ maxWidth: "860px", margin: "0 auto" }}>
          {[
            { icon: "✦", title: "AI recipe extraction", desc: "Paste any URL — AI pulls the recipe automatically." },
            { icon: "📖", title: "Beautiful cookbooks", desc: "Organize recipes with categories, photos, and notes." },
            { icon: "👨‍🍳", title: "Cook mode", desc: "Step-by-step view with ingredient checkboxes." },
            { icon: "🔗", title: "Share with anyone", desc: "Make cookbooks public and share a link." },
            { icon: "📱", title: "Works everywhere", desc: "Access your cookbooks on any device." },
            { icon: "✏️", title: "Fully customizable", desc: "Edit, reorder, and organize exactly how you like." },
          ].map((f, i) => (
            <div key={i} className="bg-white border border-gray-100 rounded-xl p-5">
              <div className="text-xl mb-2">{f.icon}</div>
              <div className="text-sm font-medium mb-1">{f.title}</div>
              <div className="text-xs text-gray-500 leading-relaxed">{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="py-16 px-6 max-w-2xl mx-auto text-center">
        <h2 className="text-2xl font-medium mb-10">How it works</h2>
        <div className="flex gap-4 justify-center flex-wrap">
          {[
            { n: "1", title: "Sign in", desc: "Use your Google account — no password needed." },
            { n: "2", title: "Create a cookbook", desc: "Name it, pick an emoji, start adding recipes." },
            { n: "3", title: "Add recipes", desc: "Paste a URL or write your own from scratch." },
            { n: "4", title: "Cook & share", desc: "Use cook mode and share with family." },
          ].map((s, i) => (
            <div key={i} className="flex-1 min-w-32 text-center">
              <div className="w-8 h-8 rounded-full bg-orange-50 text-orange-700 text-sm font-medium flex items-center justify-center mx-auto mb-2">{s.n}</div>
              <div className="text-sm font-medium mb-1">{s.title}</div>
              <div className="text-xs text-gray-500 leading-relaxed">{s.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-gray-100 py-6 text-center">
        <p className="text-xs text-gray-400">© 2026 SmartFlavr · Private beta</p>
      </div>
    </div>
  )
}