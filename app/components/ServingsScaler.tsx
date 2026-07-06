"use client"
import { parseServings, toKitchenString } from "@/lib/scale"

// Servings stepper (when the recipe declares servings) or multiplier chips
// (when it doesn't). Purely visual — emits a scale factor, never edits data.
export default function ServingsScaler({ servings, factor, onChange }: { servings: any, factor: number, onChange: (f: number) => void }) {
  const base = parseServings(servings)

  if (base) {
    const current = base * factor
    const step = base >= 4 ? 1 : 0.5
    return (
      <div className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded-xl px-1 py-0.5">
        <button
          onClick={() => onChange(Math.max(step, current - step) / base)}
          disabled={current <= step}
          className="w-7 h-7 rounded-lg text-gray-400 hover:text-orange-500 hover:bg-orange-50 disabled:opacity-30 transition text-base leading-none"
          aria-label="Fewer servings">−</button>
        <span className="text-xs font-semibold text-gray-700 min-w-[4.5rem] text-center tabular-nums">
          {toKitchenString(current)} serving{current !== 1 ? "s" : ""}
        </span>
        <button
          onClick={() => onChange((current + step) / base)}
          className="w-7 h-7 rounded-lg text-gray-400 hover:text-orange-500 hover:bg-orange-50 transition text-base leading-none"
          aria-label="More servings">+</button>
        {factor !== 1 && (
          <button onClick={() => onChange(1)} className="text-[10px] text-orange-500 font-medium px-1.5 hover:underline">Reset</button>
        )}
      </div>
    )
  }

  // No parseable servings — offer simple multipliers
  return (
    <div className="inline-flex items-center gap-1">
      {[0.5, 1, 2, 3].map(m => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition ${factor === m ? "bg-orange-500 text-white border-orange-500" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
          {m === 0.5 ? "½×" : `${m}×`}
        </button>
      ))}
    </div>
  )
}
