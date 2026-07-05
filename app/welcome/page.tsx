"use client"
import { useEffect, useMemo, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import FollowButton from "@/app/components/FollowButton"
import InstallAppButton from "@/app/components/InstallAppButton"
import { toast } from "@/app/components/Toast"
import { ClockIcon, UserIcon, StarIcon, SparkleIcon, BookIcon, PlateIcon, ListIcon, PeopleIcon } from "@/app/components/Icons"

const COLORS = ["#F97316", "#EF4444", "#8B5CF6", "#3B82F6", "#10B981", "#F59E0B", "#EC4899", "#6366F1"]
const EMOJIS = ["📖", "🍳", "🥘", "🍰", "🌮", "🥗", "🍜", "🍕"]
const STEPS = 5

function Confetti() {
  const particles = useMemo(() =>
    Array.from({ length: 26 }).map((_, i) => ({
      tx: `${(Math.random() - 0.5) * 90}vw`,
      ty: `${(Math.random() - 0.6) * 90}vh`,
      rot: `${(Math.random() - 0.5) * 720}deg`,
      size: 6 + Math.random() * 8,
      color: ["#F97316", "#FBBF24", "#34D399", "#60A5FA", "#F472B6", "#A78BFA"][i % 6],
      delay: Math.random() * 0.15,
    })), [])
  return (
    <>
      {particles.map((p, i) => (
        <span
          key={i}
          className="welcome-particle"
          style={{
            width: p.size, height: p.size, background: p.color,
            animationDelay: `${p.delay}s`,
            ["--tx" as any]: p.tx, ["--ty" as any]: p.ty, ["--rot" as any]: p.rot,
          }}
        />
      ))}
    </>
  )
}

export default function WelcomePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [celebrating, setCelebrating] = useState(false)

  // Step 1 — identity
  const [profile, setProfile] = useState<any>(null)
  const [username, setUsername] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [usernameError, setUsernameError] = useState("")

  // Step 2 — cookbook
  const [cookbook, setCookbook] = useState<any>(null)
  const [cbTitle, setCbTitle] = useState("My Recipes")
  const [cbEmoji, setCbEmoji] = useState("📖")
  const [cbColor, setCbColor] = useState("#F97316")

  // Step 3 — first recipe
  const [recipeUrl, setRecipeUrl] = useState("")
  const [extracting, setExtracting] = useState(false)
  const [savedRecipe, setSavedRecipe] = useState<any>(null)

  // Step 4 — people
  const [people, setPeople] = useState<any[]>([])

  useEffect(() => {
    if (status === "unauthenticated") { router.replace("/login?code=returning"); return }
    if (status !== "authenticated") return
    fetch("/api/onboarding").then(r => r.json()).then(d => {
      if (d.onboarded && d.hasUsername) { router.replace("/dashboard"); return }
    }).catch(() => {})
    fetch("/api/profile").then(r => r.json()).then(d => {
      if (d.user) {
        setProfile(d.user)
        setUsername(d.user.username || "")
        setDisplayName(d.user.name || session?.user?.name || "")
      }
    }).catch(() => {})
    fetch("/api/cookbooks").then(r => r.json()).then(d => {
      const first = (d.cookbooks || [])[0]
      if (first) {
        setCookbook(first)
        setCbTitle(first.title || "My Recipes")
        setCbEmoji(first.cover_emoji || "📖")
        setCbColor(first.cover_color || "#F97316")
      }
    }).catch(() => {})
    fetch("/api/explore?type=people").then(r => r.json()).then(d => {
      setPeople((d.users || []).slice(0, 4))
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  async function saveIdentity() {
    const clean = username.trim().toLowerCase()
    if (!clean) { setUsernameError("Pick a username to continue"); return }
    if (clean.length < 3) { setUsernameError("At least 3 characters"); return }
    if (!displayName.trim()) { setUsernameError("Add your name too"); return }
    setSaving(true)
    setUsernameError("")
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: clean,
        name: displayName.trim(),
        bio: profile?.bio || "",
        profile_image: profile?.profile_image || session?.user?.image || "",
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (data.error) { setUsernameError(data.error); return }
    setStep(1)
  }

  async function saveCookbook() {
    if (!cbTitle.trim()) return setStep(2)
    setSaving(true)
    if (cookbook) {
      await fetch(`/api/cookbooks/${cookbook.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: cbTitle.trim(), cover_emoji: cbEmoji, cover_color: cbColor, cover_image: cookbook.cover_image || "", is_public: cookbook.is_public ?? 0 }),
      })
    } else {
      const res = await fetch("/api/cookbooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: cbTitle.trim(), cover_emoji: cbEmoji, cover_color: cbColor }),
      })
      const data = await res.json()
      if (data.id) setCookbook({ id: data.id, title: cbTitle.trim() })
    }
    setSaving(false)
    setStep(2)
  }

  async function extractFirstRecipe() {
    if (!recipeUrl.trim() || extracting) return
    setExtracting(true)
    const res = await fetch("/api/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: recipeUrl.trim() }),
    })
    const data = await res.json()
    if (data.success && data.recipe) {
      const { nutrition: _n, ...recipeData } = data.recipe
      let cbId = cookbook?.id
      if (!cbId) {
        const cbRes = await fetch("/api/cookbooks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: cbTitle || "My Recipes", cover_emoji: cbEmoji, cover_color: cbColor }) })
        const cbData = await cbRes.json()
        cbId = cbData.id
        if (cbId) setCookbook({ id: cbId, title: cbTitle || "My Recipes" })
      }
      if (cbId) {
        await fetch("/api/recipes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...recipeData, cookbook_id: cbId }) })
        setSavedRecipe(data.recipe)
      }
    } else if (data.error === "limit_reached") {
      toast.info("You've hit this week's AI limit — you can add recipes later!")
    } else {
      toast.error("Couldn't read that link. Try another, or skip for now.")
    }
    setExtracting(false)
  }

  async function finish() {
    setCelebrating(true)
    fetch("/api/onboarding", { method: "PUT" }).catch(() => {})
    setTimeout(() => router.push("/dashboard"), 1400)
  }

  if (status === "loading") return <div className="min-h-screen bg-orange-50" />

  const stepTitle = ["Claim your name", "Your first cookbook", "Add your first recipe", "Find your people", "You're all set"][step]

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col">
      {/* Animated backdrop */}
      <div
        className="absolute inset-0 pointer-events-none animate-gradient-shift"
        style={{ background: "linear-gradient(135deg, #ffffff 0%, #fff7ed 25%, #ffedd5 50%, #fff7ed 75%, #ffffff 100%)", backgroundSize: "300% 300%" }}
      />
      <div className="absolute pointer-events-none animate-float" style={{ width: 380, height: 380, top: -100, right: "-5%", background: "radial-gradient(circle, rgba(249,115,22,0.25) 0%, rgba(251,146,60,0.08) 50%, transparent 70%)" }} />
      <div className="absolute pointer-events-none animate-float-slow" style={{ width: 340, height: 340, bottom: -80, left: "-5%", background: "radial-gradient(circle, rgba(253,186,116,0.3) 0%, transparent 65%)", animationDelay: "2s" }} />

      {celebrating && <Confetti />}

      {/* Header: progress dots + skip */}
      <div className="relative z-10 flex items-center justify-between px-6 pt-6" style={{ paddingTop: "max(1.5rem, env(safe-area-inset-top))" }}>
        <div className="flex items-center gap-2">
          {Array.from({ length: STEPS }).map((_, i) => (
            <span key={i} className={`rounded-full transition-all duration-500 ${i === step ? "w-7 h-2 bg-orange-500" : i < step ? "w-2 h-2 bg-orange-400" : "w-2 h-2 bg-orange-200"}`} />
          ))}
        </div>
        {step > 0 && step < STEPS - 1 && (
          <button onClick={() => setStep(s => s + 1)} className="text-xs font-medium text-gray-400 hover:text-gray-600 transition">Skip →</button>
        )}
      </div>

      {/* Step content */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-6 py-8">
        <div key={step} className="w-full max-w-md animate-fade-up">

          {step === 0 && (
            <div className="text-center">
              <div className="w-28 h-28 mx-auto mb-6 animate-float" style={{ animationDuration: "5s" }}>
                <Image src="/logo.svg" alt="SmartFlavr" width={112} height={112} priority />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Welcome{displayName ? `, ${displayName.split(" ")[0]}` : ""}!
              </h1>
              <p className="text-gray-500 text-sm mb-8 leading-relaxed">Let's get your kitchen set up. First — what should friends call you?</p>
              <div className="text-left space-y-3 mb-2">
                <div>
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5 block">Your name</label>
                  <input
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 text-sm outline-none focus:border-orange-400 transition shadow-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5 block">Username</label>
                  <div className="flex items-center bg-white border border-gray-200 rounded-2xl px-4 shadow-sm focus-within:border-orange-400 transition">
                    <span className="text-gray-300 text-sm">@</span>
                    <input
                      value={username}
                      onChange={e => { setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, "")); setUsernameError("") }}
                      onKeyDown={e => e.key === "Enter" && saveIdentity()}
                      placeholder="chefsomething"
                      autoFocus
                      className="flex-1 min-w-0 px-1.5 py-3 text-sm outline-none bg-transparent"
                    />
                  </div>
                  {usernameError && <p className="text-xs text-red-500 mt-1.5 animate-fade-up">{usernameError}</p>}
                </div>
              </div>
              <button
                onClick={saveIdentity}
                disabled={saving}
                className="w-full mt-6 bg-orange-500 text-white py-3.5 rounded-2xl text-sm font-semibold hover:bg-orange-600 active:scale-[0.98] transition shadow-md shadow-orange-200 disabled:opacity-60">
                {saving ? "Saving..." : "Continue →"}
              </button>
            </div>
          )}

          {step === 1 && (
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Your first cookbook</h1>
              <p className="text-gray-500 text-sm mb-6 leading-relaxed">Cookbooks hold your recipes. We made you one — make it yours.</p>
              {/* Live preview card */}
              <div className="w-44 mx-auto mb-6 rounded-2xl overflow-hidden border border-gray-100 shadow-lg bg-white animate-pop-in">
                <div className="h-24 flex items-center justify-center transition-colors duration-300" style={{ backgroundColor: cbColor + "22" }}>
                  <span className="text-4xl animate-bubble-pop" key={cbEmoji}>{cbEmoji}</span>
                </div>
                <div className="px-3 py-2.5 text-sm font-medium text-gray-900 truncate">{cbTitle || "My Recipes"}</div>
              </div>
              <input
                value={cbTitle}
                onChange={e => setCbTitle(e.target.value)}
                placeholder="Cookbook name"
                className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 text-sm outline-none focus:border-orange-400 transition shadow-sm mb-4 text-center"
              />
              <div className="flex justify-center gap-2 mb-4 flex-wrap">
                {EMOJIS.map(em => (
                  <button key={em} onClick={() => setCbEmoji(em)} className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition ${cbEmoji === em ? "bg-orange-100 ring-2 ring-orange-400 scale-110" : "bg-white border border-gray-100 hover:bg-gray-50"}`}>
                    {em}
                  </button>
                ))}
              </div>
              <div className="flex justify-center gap-2 mb-6">
                {COLORS.map(c => (
                  <button key={c} onClick={() => setCbColor(c)} className={`w-7 h-7 rounded-full transition ${cbColor === c ? "ring-2 ring-offset-2 ring-gray-400 scale-110" : ""}`} style={{ backgroundColor: c }} />
                ))}
              </div>
              <button
                onClick={saveCookbook}
                disabled={saving}
                className="w-full bg-orange-500 text-white py-3.5 rounded-2xl text-sm font-semibold hover:bg-orange-600 active:scale-[0.98] transition shadow-md shadow-orange-200 disabled:opacity-60">
                {saving ? "Saving..." : "Looks good →"}
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-orange-100 flex items-center justify-center text-orange-500 animate-pop-in"><SparkleIcon size={26} /></div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Add your first recipe</h1>
              <p className="text-gray-500 text-sm mb-6 leading-relaxed">Paste any recipe link — AI pulls it in clean. No ads, no life stories.</p>
              {!savedRecipe ? (
                <>
                  <div className="flex gap-2 mb-3">
                    <input
                      value={recipeUrl}
                      onChange={e => setRecipeUrl(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && extractFirstRecipe()}
                      placeholder="https://any-recipe-site.com/..."
                      className="flex-1 min-w-0 bg-white border border-gray-200 rounded-2xl px-4 py-3 text-sm outline-none focus:border-orange-400 transition shadow-sm"
                    />
                  </div>
                  <button
                    onClick={extractFirstRecipe}
                    disabled={extracting || !recipeUrl.trim()}
                    className="w-full bg-orange-500 text-white py-3.5 rounded-2xl text-sm font-semibold hover:bg-orange-600 active:scale-[0.98] transition shadow-md shadow-orange-200 disabled:opacity-60 flex items-center justify-center gap-2">
                    {extracting ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        Reading the recipe...
                      </>
                    ) : (
                      <><SparkleIcon size={15} /> Extract it</>
                    )}
                  </button>
                </>
              ) : (
                <div className="animate-pop-in">
                  <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-lg text-left mb-5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="24" strokeDashoffset="24" className="animate-check-draw"><polyline points="20 6 9 17 4 12"/></svg>
                      </span>
                      <span className="text-xs font-semibold text-green-600">Saved to {cbTitle || "your cookbook"}!</span>
                    </div>
                    <p className="font-semibold text-gray-900 text-sm mb-1">{savedRecipe.title}</p>
                    {savedRecipe.description && <p className="text-xs text-gray-400 line-clamp-2 mb-2">{savedRecipe.description}</p>}
                    <div className="flex gap-3 text-xs text-gray-400">
                      {savedRecipe.prep_time && <span className="flex items-center gap-1"><ClockIcon size={11} />{savedRecipe.prep_time}</span>}
                      {savedRecipe.servings && <span className="flex items-center gap-1"><UserIcon size={11} />{savedRecipe.servings}</span>}
                      {savedRecipe.difficulty && <span className="flex items-center gap-1"><StarIcon size={11} />{savedRecipe.difficulty}</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => setStep(3)}
                    className="w-full bg-orange-500 text-white py-3.5 rounded-2xl text-sm font-semibold hover:bg-orange-600 active:scale-[0.98] transition shadow-md shadow-orange-200">
                    Nice! Keep going →
                  </button>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="text-center">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-500 animate-pop-in"><PeopleIcon size={26} /></div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Find your people</h1>
              <p className="text-gray-500 text-sm mb-6 leading-relaxed">Follow someone and have them follow back — friends can share cookbooks, grocery lists, and meal plans.</p>
              {people.length === 0 ? (
                <p className="text-sm text-gray-400 py-6">You can find people later on the Explore tab.</p>
              ) : (
                <div className="space-y-2.5 mb-6 text-left">
                  {people.map((p: any, i: number) => (
                    <div key={p.username} className="flex items-center gap-3 bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm animate-fade-up" style={{ animationDelay: `${i * 0.08}s`, opacity: 0 }}>
                      {p.profile_image ? (
                        <img src={p.profile_image} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center text-white text-sm font-medium flex-shrink-0">{p.name?.charAt(0)}</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                        <p className="text-xs text-gray-400 truncate">@{p.username}</p>
                      </div>
                      <FollowButton username={p.username} />
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={() => setStep(4)}
                className="w-full bg-orange-500 text-white py-3.5 rounded-2xl text-sm font-semibold hover:bg-orange-600 active:scale-[0.98] transition shadow-md shadow-orange-200">
                Continue →
              </button>
            </div>
          )}

          {step === 4 && (
            <div className="text-center">
              <div className="w-24 h-24 mx-auto mb-5 animate-float" style={{ animationDuration: "5s" }}>
                <Image src="/logo.svg" alt="SmartFlavr" width={96} height={96} />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">You're all set!</h1>
              <p className="text-gray-500 text-sm mb-6 leading-relaxed">Here's your kitchen, at a glance:</p>
              <div className="space-y-2.5 mb-6 text-left">
                {[
                  { icon: <BookIcon size={17} />, color: "bg-orange-100 text-orange-500", title: "Home", desc: "Your cookbooks, recipe imports, and grocery lists" },
                  { icon: <ClockIcon size={17} />, color: "bg-blue-100 text-blue-500", title: "Planner", desc: "Plan meals, set nutrition goals, sync with a partner" },
                  { icon: <ListIcon size={17} />, color: "bg-green-100 text-green-600", title: "Kitchen", desc: "Track what you have — AI finds recipes you can make" },
                  { icon: <PlateIcon size={17} />, color: "bg-pink-100 text-pink-500", title: "Feed", desc: "See what friends are cooking and share your wins" },
                ].map((f, i) => (
                  <div key={f.title} className="flex items-center gap-3.5 bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm animate-fade-up" style={{ animationDelay: `${i * 0.1}s`, opacity: 0 }}>
                    <span className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${f.color}`}>{f.icon}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{f.title}</p>
                      <p className="text-xs text-gray-400 leading-snug">{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-col gap-2.5">
                <button
                  onClick={finish}
                  disabled={celebrating}
                  className="w-full bg-orange-500 text-white py-3.5 rounded-2xl text-sm font-semibold hover:bg-orange-600 active:scale-[0.98] transition shadow-md shadow-orange-200 disabled:opacity-70">
                  {celebrating ? "Let's cook!" : "Start cooking →"}
                </button>
                <InstallAppButton className="w-full border border-orange-200 bg-white text-orange-500 py-3 rounded-2xl text-sm font-medium hover:bg-orange-50 transition inline-flex items-center justify-center gap-2" />
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Back link */}
      {step > 0 && !celebrating && (
        <div className="relative z-10 pb-6 text-center" style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}>
          <button onClick={() => setStep(s => s - 1)} className="text-xs text-gray-300 hover:text-gray-500 transition">← Back</button>
        </div>
      )}
    </div>
  )
}
