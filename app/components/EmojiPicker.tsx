"use client"

// A curated set rather than a full emoji keyboard — these covers are
// small and decorative, so a tap-to-pick grid keeps them consistent
// (and stops the field from doubling as a free-text input).
const EMOJI_OPTIONS = [
  "📖", "🍳", "🥘", "🍰", "🌮", "🥗", "🍜", "🍕",
  "🍔", "🥞", "🍲", "🍱", "🧁", "🍩", "☕", "🥑",
]

export default function EmojiPicker({ value, onChange }: { value: string; onChange: (emoji: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {EMOJI_OPTIONS.map(em => (
        <button
          key={em}
          type="button"
          onClick={() => onChange(em)}
          className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition ${value === em ? "bg-orange-100 ring-2 ring-orange-400 scale-110" : "bg-white border border-gray-100 hover:bg-gray-50"}`}>
          {em}
        </button>
      ))}
    </div>
  )
}
