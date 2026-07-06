"use client"
import { useEffect, useRef, useState } from "react"
import { signIn } from "next-auth/react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { BookIcon, LinkIcon, PlateIcon, SparkleIcon, PencilIcon, SearchIcon, ClockIcon, PeopleIcon, ListIcon, FlameIcon, CheckIcon } from "@/app/components/Icons"
import InstallAppButton from "@/app/components/InstallAppButton"

// Fades content up as it scrolls into view
function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode, delay?: number, className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setShown(true); obs.disconnect() }
    }, { threshold: 0.15 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return (
    <div ref={ref} className={`${className} ${shown ? "animate-fade-up" : "opacity-0"}`} style={{ animationDelay: `${delay}s` }}>
      {children}
    </div>
  )
}

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
      icon: <SearchIcon size={24} />,
      title: "Paste a link. Get a clean recipe.",
      desc: "Drop any recipe URL and SmartFlavr pulls in the title, ingredients, and steps — no ads, no scroll-past-my-whole-life-story, no pop-ups. Just the recipe, ready to use.",
    },
    {
      icon: <BookIcon size={24} />,
      title: "Build beautiful cookbooks.",
      desc: "Organize recipes into themed collections with cover art and custom categories. Weeknight dinners, holiday bakes, family classics — each cookbook feels like something you actually made.",
    },
    {
      icon: <PlateIcon size={24} />,
      title: "Cook mode keeps you on track.",
      desc: "Walk through each step one at a time, check off ingredients as you go, and keep your screen from locking mid-recipe. Designed for people cooking with flour on their hands.",
    },
    {
      icon: <LinkIcon size={24} />,
      title: "Share with anyone, instantly.",
      desc: "Make a cookbook public and share one clean link — no account or app needed to browse it. Great for sending family recipes, planning a dinner party, or showing off what you've built.",
    },
    {
      icon: <SparkleIcon size={24} />,
      title: "AI that actually does something.",
      desc: "Import recipes from photos, scanned pages, and PDFs. Generate nutrition facts, sharpen your instructions, and turn any recipe into an organized grocery list — all in one tap.",
    },
    {
      icon: <PencilIcon size={24} />,
      title: "Edit recipes to match how you cook.",
      desc: "More garlic, less salt, different pan — save your version of every recipe so next time it's already exactly how you make it. No sticky notes required.",
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

        {/* Floating product cards (desktop only) */}
        <div className="hidden lg:block absolute left-[4%] top-24 w-52 animate-float pointer-events-none" style={{ animationDuration: "9s" }}>
          <div className="bg-white/90 backdrop-blur rounded-2xl shadow-xl border border-orange-100 p-4 -rotate-6">
            <div className="h-20 rounded-xl bg-gradient-to-br from-orange-200 to-amber-100 mb-3 flex items-center justify-center text-orange-400"><PlateIcon size={28} /></div>
            <div className="h-2.5 w-3/4 bg-gray-200 rounded-full mb-2" />
            <div className="h-2 w-1/2 bg-gray-100 rounded-full mb-3" />
            <div className="flex items-center gap-1.5 text-[10px] text-orange-500 font-semibold">
              <SparkleIcon size={10} /> Imported from a link
            </div>
          </div>
        </div>
        <div className="hidden lg:block absolute right-[4%] top-36 w-48 animate-float-slow pointer-events-none" style={{ animationDuration: "11s" }}>
          <div className="bg-white/90 backdrop-blur rounded-2xl shadow-xl border border-orange-100 p-4 rotate-6">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-3"><ListIcon size={11} /> Grocery list</div>
            {["Chicken breast", "Basil", "Parmesan"].map((item, i) => (
              <div key={item} className="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0">
                <span className={`w-3.5 h-3.5 rounded flex items-center justify-center ${i < 2 ? "bg-orange-500 text-white" : "border border-gray-200"}`}>
                  {i < 2 && <CheckIcon size={9} />}
                </span>
                <span className={`text-[11px] ${i < 2 ? "text-gray-300 line-through" : "text-gray-600"}`}>{item}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="hidden lg:block absolute right-[14%] bottom-16 animate-float pointer-events-none" style={{ animationDelay: "2.5s" }}>
          <div className="bg-gray-900/95 text-white rounded-full shadow-xl pl-3 pr-4 py-2 flex items-center gap-2 rotate-3">
            <ClockIcon size={13} className="text-orange-400" />
            <span className="text-sm font-bold tabular-nums">12:45</span>
            <span className="text-[10px] text-gray-400">simmer timer</span>
          </div>
        </div>
        <div className="hidden lg:block absolute left-[12%] bottom-24 animate-float-slow pointer-events-none" style={{ animationDelay: "1s" }}>
          <div className="bg-white/90 backdrop-blur rounded-full shadow-lg border border-blue-100 pl-2 pr-4 py-1.5 flex items-center gap-2 -rotate-3">
            <span className="w-6 h-6 rounded-full bg-blue-400 flex items-center justify-center text-white"><PeopleIcon size={12} /></span>
            <span className="text-[11px] text-gray-600 font-medium">Alex is editing…</span>
          </div>
        </div>

        <div className="relative max-w-3xl mx-auto z-10">
          <div
            className="inline-block bg-orange-100 text-orange-600 text-xs font-semibold px-4 py-1.5 rounded-full mb-8 animate-fade-up"
            style={{ animationDelay: "0s" }}>
            Private beta — invite only
          </div>

          <h1
            className="text-5xl sm:text-6xl font-bold leading-[1.1] mb-6 text-gray-900 animate-fade-up"
            style={{ animationDelay: "0.1s", opacity: 0 }}>
            Stop losing<br />recipes you love.<br />
            <span
              className="text-transparent bg-clip-text animate-gradient-shift"
              style={{ backgroundImage: "linear-gradient(90deg, #f97316, #fbbf24, #ef4444, #f97316)", backgroundSize: "300% auto" }}>
              Start cooking smarter.
            </span>
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
              <div className="flex flex-col sm:flex-row gap-3 items-center">
                <button
                  onClick={() => setShowInvite(true)}
                  className="px-7 py-3 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 active:scale-95 transition-all text-sm animate-glow-pulse">
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
                <InstallAppButton className="px-7 py-3 border border-orange-200 bg-white text-orange-500 rounded-xl font-medium hover:bg-orange-50 active:scale-95 transition-all text-sm inline-flex items-center gap-2" />
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

      {/* Capability ticker */}
      <div className="bg-gray-900 py-3.5 overflow-hidden relative">
        <div className="flex whitespace-nowrap animate-marquee w-max">
          {[0, 1].map(dup => (
            <div key={dup} className="flex items-center">
              {["AI recipe import", "Live co-edited cookbooks", "Synced meal plans", "Smart grocery lists", "Cooking mode with timers", "What can I make?", "Nutrition tracking", "Recipe scaling"].map(t => (
                <span key={t} className="flex items-center gap-2.5 text-xs font-semibold text-gray-400 mx-5">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />{t}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Features */}
      <div className="bg-gray-50 py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <Reveal>
            <h2 className="text-3xl font-bold text-center mb-2 text-gray-900">
              Everything you need to cook smarter.
            </h2>
            <p className="text-center text-gray-400 mb-12 text-base">No fluff. Just the tools that actually matter.</p>
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {features.map((f, i) => (
              <Reveal key={i} delay={i * 0.08}>
                <div className="bg-white border border-gray-100 rounded-2xl p-6 h-full hover:-translate-y-1.5 hover:shadow-lg hover:border-orange-200 transition-all duration-300 cursor-default group">
                  <div className="w-11 h-11 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-3 group-hover:bg-orange-500 group-hover:text-white transition-all duration-300">
                    {f.icon}
                  </div>
                  <div className="text-sm font-semibold mb-2 text-gray-900">{f.title}</div>
                  <div className="text-sm text-gray-500 leading-relaxed">{f.desc}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <Reveal>
            <h2 className="text-3xl font-bold text-center mb-2 text-gray-900">
              Up and running in under 2 minutes.
            </h2>
            <p className="text-center text-gray-400 mb-12 text-base">Seriously, that's all it takes.</p>
          </Reveal>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {[
              { n: "1", title: "Get an invite", desc: "Ask someone who's already cooking with SmartFlavr." },
              { n: "2", title: "Sign up instantly", desc: "Enter your code and sign in with Google. Done in 30 seconds." },
              { n: "3", title: "Save a recipe", desc: "Paste any URL — AI pulls the recipe in clean, instantly." },
              { n: "4", title: "Cook and share", desc: "Use cook mode tonight. Share your cookbook tomorrow." },
            ].map((s, i) => (
              <Reveal key={i} delay={i * 0.12}>
                <div className="text-center">
                  <div className="w-10 h-10 rounded-full bg-orange-500 text-white text-sm font-bold flex items-center justify-center mx-auto mb-3 shadow-sm shadow-orange-200">
                    {s.n}
                  </div>
                  <div className="text-sm font-semibold mb-1 text-gray-900">{s.title}</div>
                  <div className="text-xs text-gray-500 leading-relaxed">{s.desc}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>

      {/* Contact */}
      <div className="relative bg-orange-500 py-16 px-6 text-center text-white overflow-hidden">
        <div className="absolute -top-10 -right-10 w-64 h-64 bg-orange-400 rounded-full blur-3xl opacity-40 pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-64 h-64 bg-orange-600 rounded-full blur-3xl opacity-30 pointer-events-none" />
        <div className="relative z-10">
          <h2 className="text-3xl font-bold mb-3">Have a question or idea?</h2>
          <p className="text-orange-100 mb-2 text-base max-w-sm mx-auto">
            SmartFlavr is in private beta and we&apos;re actively shaping it. Bug reports, feature ideas, feedback — all of it is welcome.
          </p>
          <p className="text-orange-200/70 text-sm mb-8">We read every message.</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="mailto:smartflavroperations@gmail.com"
              className="inline-block px-8 py-3 bg-white text-orange-500 rounded-xl font-bold hover:bg-orange-50 active:scale-95 transition-all text-sm shadow-md">
              smartflavroperations@gmail.com
            </a>
            <a
              href="https://aarynwarrior.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-8 py-3 border-2 border-white/40 text-white rounded-xl font-bold hover:bg-white/10 active:scale-95 transition-all text-sm">
              aarynwarrior.com
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
            </a>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-100 py-6 px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-400">
        <span>© 2026 SmartFlavr · Private beta · <a href="https://aarynwarrior.com" target="_blank" rel="noopener noreferrer" className="hover:text-orange-500 transition">aarynwarrior.com</a></span>
        <div className="flex gap-4">
          <button onClick={() => { window.scrollTo({ top: 0, behavior: "smooth" }); setTimeout(() => setShowInvite(true), 400) }} className="hover:text-orange-500 transition">Create account</button>
          <button onClick={() => router.push("/login?code=returning")} className="hover:text-orange-500 transition">Sign in</button>
        </div>
      </div>
    </div>
  )
}
