"use client"
import { useMemo, useRef, useState } from "react"
import Image from "next/image"
import { toast } from "@/app/components/Toast"
import { useTheme } from "@/app/components/ThemeProvider"
import { CameraIcon } from "@/app/components/Icons"

const CONFETTI_COLORS = ["#f97316", "#fbbf24", "#ef4444", "#f59e0b", "#fb923c", "#3b82f6", "#22c55e"]

function useConfettiPieces(count: number) {
  return useMemo(() => Array.from({ length: count }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.7,
    duration: 2.6 + Math.random() * 1.8,
    size: 6 + Math.random() * 7,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    round: Math.random() > 0.5,
    spin: 360 + Math.random() * 720,
  })), [count])
}

export default function CookingCompleteModal({ recipe, onDone }: { recipe: any; onDone: () => void }) {
  const { theme } = useTheme()
  const dark = theme === "dark"
  const confetti = useConfettiPieces(70)
  const [mode, setMode] = useState<"celebrate" | "share">("celebrate")
  const [image, setImage] = useState("")
  const [uploading, setUploading] = useState(false)
  const [caption, setCaption] = useState("")
  const [posting, setPosting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function pickPhoto(file: File) {
    if (!file.type.startsWith("image/")) return
    setUploading(true)
    const reader = new FileReader()
    reader.onload = async () => {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: reader.result }),
      })
      const data = await res.json().catch(() => null)
      setUploading(false)
      if (data?.url) setImage(data.url)
      else toast.error("Could not upload that photo — try again.")
    }
    reader.readAsDataURL(file)
  }

  async function share() {
    if (posting) return
    setPosting(true)
    const res = await fetch("/api/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "recipe",
        content: caption.trim() || `Just made ${recipe.title}!`,
        image_url: image || recipe.image_url || null,
        recipe_id: recipe.id,
        visibility: "everyone",
      }),
    })
    setPosting(false)
    if (!res.ok) { toast.error("Could not share this — try again."); return }
    toast.success("Shared to your feed!")
    onDone()
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-6 overflow-hidden"
      style={{
        background: dark
          ? "radial-gradient(circle at 50% 20%, #2a1a0f 0%, #0a0a0b 70%)"
          : "radial-gradient(circle at 50% 20%, #fff7ed 0%, #ffffff 70%)",
      }}>
      {/* Confetti shower */}
      {confetti.map(p => (
        <span
          key={p.id}
          className="absolute top-0 pointer-events-none"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.round ? p.size : p.size * 1.6,
            backgroundColor: p.color,
            borderRadius: p.round ? "50%" : "2px",
            animation: `confetti-fall ${p.duration}s cubic-bezier(.25,.46,.45,.94) ${p.delay}s forwards`,
            // @ts-ignore custom property consumed by the confetti-fall keyframe
            "--spin": `${p.spin}deg`,
          }}
        />
      ))}

      <div className="relative max-w-sm w-full text-center animate-pop-in">
        <div className="flex justify-center mb-5">
          <Image src="/logo.svg" alt="SmartFlavr" width={56} height={56} />
        </div>

        {mode === "celebrate" ? (
          <>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Nicely done! 🎉</h2>
            <p className="text-gray-500 text-sm mb-8 leading-relaxed">
              <span className="font-semibold text-gray-700">{recipe.title}</span> is ready to eat.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => setMode("share")}
                className="w-full bg-orange-500 text-white rounded-2xl py-3.5 text-sm font-semibold hover:bg-orange-600 active:scale-[0.99] transition-all flex items-center justify-center gap-2">
                <CameraIcon size={16} />
                Share what you made
              </button>
              <button
                onClick={onDone}
                className="w-full border border-gray-200 text-gray-500 rounded-2xl py-3.5 text-sm font-medium hover:bg-gray-50 transition">
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Share {recipe.title}</h2>
            <p className="text-xs text-gray-400 mb-5">Show people what you made — this posts to your feed.</p>

            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
              onChange={e => e.target.files?.[0] && pickPhoto(e.target.files[0])} />

            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-full h-36 rounded-2xl border-2 border-dashed border-gray-200 hover:border-orange-300 hover:bg-orange-50/50 transition flex flex-col items-center justify-center gap-2 mb-4 overflow-hidden bg-white">
              {uploading ? (
                <span className="text-xs text-gray-400">Uploading...</span>
              ) : image ? (
                <img src={image} className="w-full h-full object-cover" alt="" />
              ) : (
                <>
                  <CameraIcon size={22} className="text-gray-300" />
                  <span className="text-xs text-gray-400">Take or choose a photo</span>
                </>
              )}
            </button>

            <textarea
              value={caption}
              onChange={e => setCaption(e.target.value)}
              placeholder={`Just made ${recipe.title}!`}
              rows={2}
              maxLength={280}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none resize-none mb-4 bg-white"
            />

            <div className="flex gap-3">
              <button onClick={() => setMode("celebrate")} className="flex-1 border border-gray-200 rounded-2xl py-3 text-sm text-gray-500 hover:bg-gray-50 transition">Back</button>
              <button
                onClick={share}
                disabled={posting || uploading}
                className="flex-[2] bg-orange-500 text-white rounded-2xl py-3 text-sm font-semibold hover:bg-orange-600 disabled:opacity-50 transition">
                {posting ? "Sharing..." : "Post to feed"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
