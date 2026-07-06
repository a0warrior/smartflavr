"use client"
import { useState } from "react"
import { parseServings, toKitchenString } from "@/lib/scale"

// One stepper for every recipe, whether or not it has a declared serving
// count. No upper limit — tap the number to type an exact amount instead of
// clicking + repeatedly. Purely visual — emits a scale factor, never edits data.
export default function ServingsScaler({ servings, factor, onChange }: { servings: any, factor: number, onChange: (f: number) => void }) {
  const base = parseServings(servings)
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState("")

  const current = base ? base * factor : factor
  const step = current >= 4 ? 1 : 0.5
  const label = base
    ? `${toKitchenString(current)} serving${current !== 1 ? "s" : ""}`
    : `${toKitchenString(current)}×`

  function apply(next: number) {
    onChange(base ? next / base : next)
  }

  function commitEdit() {
    setEditing(false)
    const n = parseFloat(editValue)
    if (n > 0) apply(n)
  }

  return (
    <div className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded-xl px-1 py-0.5">
      <button
        onClick={() => apply(Math.max(step, current - step))}
        disabled={current <= step}
        className="w-7 h-7 rounded-lg text-gray-400 hover:text-orange-500 hover:bg-orange-50 disabled:opacity-30 transition text-base leading-none"
        aria-label="Fewer">−</button>

      {editing ? (
        <input
          autoFocus
          value={editValue}
          onChange={e => setEditValue(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={e => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditing(false) }}
          inputMode="decimal"
          className="w-14 text-xs font-semibold text-center outline-none border-b border-orange-300"
        />
      ) : (
        <button
          onClick={() => { setEditValue(String(Math.round(current * 100) / 100)); setEditing(true) }}
          title="Tap to type an exact amount"
          className="text-xs font-semibold text-gray-700 min-w-[4.5rem] text-center tabular-nums hover:text-orange-500 transition">
          {label}
        </button>
      )}

      <button
        onClick={() => apply(current + step)}
        className="w-7 h-7 rounded-lg text-gray-400 hover:text-orange-500 hover:bg-orange-50 transition text-base leading-none"
        aria-label="More">+</button>
      {factor !== 1 && (
        <button onClick={() => onChange(1)} className="text-[10px] text-orange-500 font-medium px-1.5 hover:underline">Reset</button>
      )}
    </div>
  )
}
