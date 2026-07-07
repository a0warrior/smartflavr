"use client"
import { useState } from "react"
import { PencilIcon } from "@/app/components/Icons"
import { toast } from "@/app/components/Toast"
import { percentDV, RdiKey } from "@/lib/dailyValues"

const NUMBER_FIELDS = ["calories", "protein", "carbs", "fat", "fiber", "sugar", "sodium"]
const VITAMIN_FIELDS = [
  { key: "vitamin_a", label: "Vitamin A", unit: "mcg" }, { key: "vitamin_c", label: "Vitamin C", unit: "mg" }, { key: "vitamin_d", label: "Vitamin D", unit: "mcg" },
  { key: "vitamin_b12", label: "Vitamin B12", unit: "mcg" }, { key: "vitamin_b6", label: "Vitamin B6", unit: "mg" }, { key: "folate", label: "Folate", unit: "mcg" },
]
const MINERAL_FIELDS = [
  { key: "calcium", label: "Calcium", unit: "mg" }, { key: "iron", label: "Iron", unit: "mg" }, { key: "potassium", label: "Potassium", unit: "mg" },
  { key: "magnesium", label: "Magnesium", unit: "mg" }, { key: "zinc", label: "Zinc", unit: "mg" }, { key: "phosphorus", label: "Phosphorus", unit: "mg" },
]
const MICRO_KEYS = [...VITAMIN_FIELDS, ...MINERAL_FIELDS].map(f => f.key)

export default function NutritionPanel({ recipe, onNutritionGenerated, readOnly }: { recipe: any, onNutritionGenerated?: (nutrition: any) => void, readOnly?: boolean }) {
  const [nutrition, setNutrition] = useState<any>(
    recipe.nutrition ? (typeof recipe.nutrition === "string" ? JSON.parse(recipe.nutrition) : recipe.nutrition) : null
  )
  const [perServing, setPerServing] = useState(true)
  const [editing, setEditing] = useState(false)
  const [showMicros, setShowMicros] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({})

  function setField(key: string, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function openEditor() {
    const src = nutrition || {}
    const f: Record<string, string> = {}
    for (const k of NUMBER_FIELDS) f[k] = src[k] !== undefined ? String(src[k]) : ""
    for (const { key: k } of VITAMIN_FIELDS) f[k] = src.vitamins?.[k] !== undefined ? String(src.vitamins[k]) : ""
    for (const { key: k } of MINERAL_FIELDS) f[k] = src.minerals?.[k] !== undefined ? String(src.minerals[k]) : ""
    setForm(f)
    setShowMicros(MICRO_KEYS.some(k => f[k] !== ""))
    setEditing(true)
  }

  async function save() {
    const clean: any = {}
    for (const k of NUMBER_FIELDS) {
      const v = parseFloat(form[k])
      if (form[k] !== "" && form[k] !== undefined && !isNaN(v)) clean[k] = v
    }
    const vitamins: any = {}
    for (const { key: k } of VITAMIN_FIELDS) {
      const v = parseFloat(form[k])
      if (form[k] !== "" && form[k] !== undefined && !isNaN(v)) vitamins[k] = v
    }
    const minerals: any = {}
    for (const { key: k } of MINERAL_FIELDS) {
      const v = parseFloat(form[k])
      if (form[k] !== "" && form[k] !== undefined && !isNaN(v)) minerals[k] = v
    }
    if (Object.keys(vitamins).length) clean.vitamins = vitamins
    if (Object.keys(minerals).length) clean.minerals = minerals

    if (clean.calories === undefined && clean.protein === undefined && clean.carbs === undefined && clean.fat === undefined) {
      toast.error("Enter at least calories or a macro to save.")
      return
    }

    setSaving(true)
    const res = await fetch("/api/nutrition", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipe_id: recipe.id, nutrition: clean }),
    })
    const data = await res.json()
    setSaving(false)
    if (data.error) { toast.error(data.error); return }
    setNutrition(clean)
    onNutritionGenerated?.(clean)
    setEditing(false)
    toast.success("Nutrition facts saved!")
  }

  async function removeNutrition() {
    if (!confirm("Remove nutrition facts from this recipe?")) return
    setSaving(true)
    await fetch("/api/nutrition", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipe_id: recipe.id }),
    })
    setSaving(false)
    setNutrition(null)
    onNutritionGenerated?.(null)
    setEditing(false)
    toast.success("Nutrition facts removed.")
  }

  const servings = parseInt(recipe.servings) || 1
  const multiplier = perServing ? 1 : servings

  function val(n: number | undefined | null): number | undefined {
    if (n === undefined || n === null) return undefined
    return Math.round(n * multiplier)
  }

  // ── No facts yet ──
  if (!nutrition && !editing) {
    if (readOnly) return null
    return (
      <div className="mt-6 border-t border-gray-100 pt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide">Nutrition facts</h3>
          <button
            onClick={openEditor}
            className="flex items-center gap-1.5 text-xs text-orange-500 border border-orange-200 px-3 py-1.5 rounded-lg hover:bg-orange-50 transition">
            <PencilIcon size={12} /> Add nutrition facts
          </button>
        </div>
        <p className="text-sm text-gray-400">No nutrition facts yet — add your own and we'll work out the daily-value percentages for you.</p>
      </div>
    )
  }

  // ── Edit form ──
  if (editing) {
    return (
      <div className="mt-6 border-t border-gray-100 pt-6">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide">{nutrition ? "Edit nutrition facts" : "Add nutrition facts"}</h3>
          <button onClick={() => setEditing(false)} className="text-xs text-gray-400 hover:text-gray-600 transition">Cancel</button>
        </div>
        <p className="text-xs text-gray-400 mb-4">Enter amounts <span className="font-medium text-gray-600">per serving</span>. Leave anything blank you don't know — % daily values are calculated for you.</p>

        <div className="bg-white border border-gray-100 rounded-xl p-4 mb-4">
          <label className="text-xs text-gray-500 mb-1 block">Calories</label>
          <input
            type="number" inputMode="decimal" value={form.calories || ""}
            onChange={e => setField("calories", e.target.value)}
            placeholder="e.g. 420"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none mb-4"
          />
          <div className="grid grid-cols-3 gap-3">
            {[["protein", "Protein (g)"], ["carbs", "Carbs (g)"], ["fat", "Fat (g)"]].map(([key, label]) => (
              <div key={key}>
                <label className="text-xs text-gray-500 mb-1 block">{label}</label>
                <input
                  type="number" inputMode="decimal" value={form[key] || ""}
                  onChange={e => setField(key, e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm outline-none"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-xl p-4 mb-4">
          <div className="grid grid-cols-3 gap-3">
            {[["fiber", "Fiber (g)"], ["sugar", "Sugar (g)"], ["sodium", "Sodium (mg)"]].map(([key, label]) => (
              <div key={key}>
                <label className="text-xs text-gray-500 mb-1 block">{label}</label>
                <input
                  type="number" inputMode="decimal" value={form[key] || ""}
                  onChange={e => setField(key, e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm outline-none"
                />
              </div>
            ))}
          </div>
        </div>

        <button onClick={() => setShowMicros(s => !s)} className="text-xs text-orange-500 hover:text-orange-600 mb-3 flex items-center gap-1 transition">
          {showMicros ? "Hide" : "Add"} vitamins & minerals {showMicros ? "▴" : "▾"}
        </button>

        {showMicros && (
          <div className="bg-white border border-gray-100 rounded-xl p-4 mb-4 grid grid-cols-2 gap-x-4 gap-y-3">
            {[...VITAMIN_FIELDS, ...MINERAL_FIELDS].map(({ key, label, unit }) => (
              <div key={key}>
                <label className="text-xs text-gray-500 mb-1 block">{label} ({unit})</label>
                <input
                  type="number" inputMode="decimal" value={form[key] || ""}
                  onChange={e => setField(key, e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-sm outline-none"
                />
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3">
          {nutrition && (
            <button onClick={removeNutrition} disabled={saving} className="px-4 py-2.5 border border-red-100 text-red-400 rounded-xl text-sm hover:bg-red-50 transition disabled:opacity-50">
              Remove
            </button>
          )}
          <div className="flex-1" />
          <button onClick={save} disabled={saving} className="bg-orange-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-orange-600 disabled:opacity-50 transition">
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    )
  }

  // ── Display ──
  function Bar({ pct, color }: { pct: number, color: string }) {
    return (
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: color }}/>
      </div>
    )
  }

  const barRows: { key: string, label: string, unit: string, color: string }[] = [
    { key: "protein", label: "Protein", unit: "g", color: "#3B82F6" },
    { key: "carbs", label: "Carbs", unit: "g", color: "#F59E0B" },
    { key: "fat", label: "Fat", unit: "g", color: "#EF4444" },
    { key: "fiber", label: "Fiber", unit: "g", color: "#10B981" },
    { key: "sugar", label: "Sugar", unit: "g", color: "#8B5CF6" },
    { key: "sodium", label: "Sodium", unit: "mg", color: "#6366F1" },
  ].filter(r => nutrition[r.key] !== undefined && nutrition[r.key] !== null)

  const hasMicros = Object.keys(nutrition.vitamins || {}).length > 0 || Object.keys(nutrition.minerals || {}).length > 0

  return (
    <div className="mt-6 border-t border-gray-100 pt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide">Nutrition facts</h3>
        <div className="flex items-center gap-2">
          {!readOnly && (
            <button onClick={openEditor} className="flex items-center gap-1 text-xs text-gray-400 hover:text-orange-500 transition px-2 py-1 rounded-lg hover:bg-orange-50">
              <PencilIcon size={11} /> Edit
            </button>
          )}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
            <button
              onClick={() => setPerServing(true)}
              className={`px-3 py-1 transition ${perServing ? "bg-orange-500 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
              Per serving
            </button>
            <button
              onClick={() => setPerServing(false)}
              className={`px-3 py-1 transition ${!perServing ? "bg-orange-500 text-white" : "text-gray-500 hover:bg-gray-50"}`}>
              Whole recipe
            </button>
          </div>
        </div>
      </div>

      <div className={`grid grid-cols-1 ${hasMicros ? "md:grid-cols-2" : ""} gap-4`}>
        <div className="bg-white border border-gray-100 rounded-xl p-4">
          <div className="flex items-baseline gap-2 mb-4 pb-4 border-b border-gray-100">
            <span className="text-3xl font-medium">{val(nutrition.calories) ?? "–"}</span>
            <span className="text-sm text-gray-500">calories</span>
            <span className="text-xs text-gray-400 ml-auto">
              {perServing ? `per serving · ${servings} servings total` : "whole recipe"}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: "Protein", val: val(nutrition.protein), unit: "g", color: "#3B82F6" },
              { label: "Carbs", val: val(nutrition.carbs), unit: "g", color: "#F59E0B" },
              { label: "Fat", val: val(nutrition.fat), unit: "g", color: "#EF4444" },
            ].map(m => (
              <div key={m.label} className="bg-gray-50 rounded-xl p-3 text-center">
                <div className="text-lg font-medium" style={{ color: m.color }}>{m.val ?? "–"}{m.val !== undefined && <span className="text-xs text-gray-400">{m.unit}</span>}</div>
                <div className="text-xs text-gray-500 mt-1">{m.label}</div>
              </div>
            ))}
          </div>

          {barRows.length > 0 && barRows.map(r => {
            const pct = percentDV(r.key as RdiKey, nutrition[r.key] * multiplier) ?? 0
            return (
              <div key={r.key} className="flex items-center gap-3 mb-2">
                <span className="text-xs text-gray-500 w-14 flex-shrink-0">{r.label}</span>
                <Bar pct={pct} color={r.color}/>
                <span className="text-xs text-gray-400 w-16 text-right flex-shrink-0">{val(nutrition[r.key])}{r.unit} · {pct}%</span>
              </div>
            )
          })}
          {!hasMicros && <p className="text-xs text-gray-400 mt-3 pt-3 border-t border-gray-100">Entered manually. Not a substitute for professional dietary advice.</p>}
        </div>

        {hasMicros && (
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Micronutrients · % daily value</p>
            <div className="grid grid-cols-2 gap-x-4">
              <div>
                {VITAMIN_FIELDS.filter(({ key }) => nutrition.vitamins?.[key] !== undefined).map(({ key, label, unit }) => {
                  const amount = nutrition.vitamins[key]
                  const pct = percentDV(key as RdiKey, amount * multiplier) ?? 0
                  const displayAmount = amount * multiplier
                  return (
                    <div key={key} className="flex items-center justify-between py-1.5 border-b border-gray-50 text-xs">
                      <span className="text-gray-500">{label}</span>
                      <span className="text-right">
                        <span className="font-medium text-gray-900">{displayAmount < 10 ? displayAmount.toFixed(1) : Math.round(displayAmount)}{unit}</span>
                        <span className="text-gray-400 ml-1">{pct}%</span>
                      </span>
                    </div>
                  )
                })}
              </div>
              <div>
                {MINERAL_FIELDS.filter(({ key }) => nutrition.minerals?.[key] !== undefined).map(({ key, label, unit }) => {
                  const amount = nutrition.minerals[key]
                  const pct = percentDV(key as RdiKey, amount * multiplier) ?? 0
                  const displayAmount = amount * multiplier
                  return (
                    <div key={key} className="flex items-center justify-between py-1.5 border-b border-gray-50 text-xs">
                      <span className="text-gray-500">{label}</span>
                      <span className="text-right">
                        <span className="font-medium text-gray-900">{displayAmount < 10 ? displayAmount.toFixed(1) : Math.round(displayAmount)}{unit}</span>
                        <span className="text-gray-400 ml-1">{pct}%</span>
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-3">Entered manually. Not a substitute for professional dietary advice.</p>
          </div>
        )}
      </div>
    </div>
  )
}
