"use client"
import { useState } from "react"

export default function NutritionPanel({ recipe }: { recipe: any }) {
  const [nutrition, setNutrition] = useState<any>(
    recipe.nutrition ? (typeof recipe.nutrition === "string" ? JSON.parse(recipe.nutrition) : recipe.nutrition) : null
  )
  const [loading, setLoading] = useState(false)
  const [perServing, setPerServing] = useState(true)

  async function generateNutrition() {
    if (!recipe.ingredients) return
    setLoading(true)
    const res = await fetch("/api/nutrition", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipe_id: recipe.id,
        ingredients: recipe.ingredients,
        servings: parseInt(recipe.servings) || 1,
      }),
    })
    const data = await res.json()
    if (data.success) setNutrition(data.nutrition)
    setLoading(false)
  }

  const servings = parseInt(recipe.servings) || 1
  const multiplier = perServing ? 1 : servings

  function val(n: number) {
    return Math.round((n || 0) * multiplier)
  }

  function dv(n: number) {
    return Math.min(100, Math.round((n || 0)))
  }

  function Bar({ pct, color }: { pct: number, color: string }) {
    return (
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, backgroundColor: color }}/>
      </div>
    )
  }

  return (
    <div className="mt-6 border-t border-gray-100 pt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide">Nutrition facts</h3>
        <div className="flex items-center gap-2">
          {nutrition && (
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
          )}
          <button
            onClick={generateNutrition}
            disabled={loading || !recipe.ingredients}
            className="text-xs text-orange-500 hover:text-orange-600 flex items-center gap-1 disabled:opacity-50">
            {loading ? "✨ Calculating..." : nutrition ? "✨ Regenerate" : "✨ Generate nutrition"}
          </button>
        </div>
      </div>

      {!nutrition && !loading && (
        <div className="bg-gray-50 rounded-xl p-6 text-center">
          <p className="text-sm text-gray-400 mb-2">No nutrition data yet</p>
          <p className="text-xs text-gray-400">Click ✨ Generate nutrition to get AI-estimated nutrition facts</p>
        </div>
      )}

      {loading && (
        <div className="bg-gray-50 rounded-xl p-6 text-center">
          <p className="text-sm text-gray-400">Calculating nutrition facts...</p>
        </div>
      )}

      {nutrition && !loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <div className="flex items-baseline gap-2 mb-4 pb-4 border-b border-gray-100">
              <span className="text-3xl font-medium">{val(nutrition.calories)}</span>
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
                  <div className="text-lg font-medium" style={{ color: m.color }}>{m.val}<span className="text-xs text-gray-400">{m.unit}</span></div>
                  <div className="text-xs text-gray-500 mt-1">{m.label}</div>
                </div>
              ))}
            </div>

            {[
              { label: "Protein", val: val(nutrition.protein), pct: dv(nutrition.daily_values?.protein), color: "#3B82F6", unit: "g" },
              { label: "Carbs", val: val(nutrition.carbs), pct: dv(nutrition.daily_values?.carbs), color: "#F59E0B", unit: "g" },
              { label: "Fat", val: val(nutrition.fat), pct: dv(nutrition.daily_values?.fat), color: "#EF4444", unit: "g" },
              { label: "Fiber", val: val(nutrition.fiber), pct: dv(nutrition.daily_values?.fiber), color: "#10B981", unit: "g" },
              { label: "Sugar", val: val(nutrition.sugar), pct: dv(nutrition.daily_values?.sugar), color: "#8B5CF6", unit: "g" },
              { label: "Sodium", val: val(nutrition.sodium), pct: dv(nutrition.daily_values?.sodium), color: "#6366F1", unit: "mg" },
            ].map(m => (
              <div key={m.label} className="flex items-center gap-3 mb-2">
                <span className="text-xs text-gray-500 w-14 flex-shrink-0">{m.label}</span>
                <Bar pct={m.pct} color={m.color}/>
                <span className="text-xs text-gray-400 w-16 text-right flex-shrink-0">{m.val}{m.unit} · {m.pct}%</span>
              </div>
            ))}
          </div>

          <div className="bg-white border border-gray-100 rounded-xl p-4">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Micronutrients · % daily value</p>
            <div className="grid grid-cols-2 gap-x-4">
              <div>
                {[
                  { label: "Vitamin A", val: `${val(nutrition.vitamins?.vitamin_a)}mcg`, pct: dv(nutrition.daily_values?.vitamin_a) },
                  { label: "Vitamin C", val: `${val(nutrition.vitamins?.vitamin_c)}mg`, pct: dv(nutrition.daily_values?.vitamin_c) },
                  { label: "Vitamin D", val: `${val(nutrition.vitamins?.vitamin_d)}mcg`, pct: dv(nutrition.daily_values?.vitamin_d) },
                  { label: "Vitamin B12", val: `${(((nutrition.vitamins?.vitamin_b12 || 0) * multiplier)).toFixed(1)}mcg`, pct: dv(nutrition.daily_values?.vitamin_b12) },
                  { label: "Vitamin B6", val: `${(((nutrition.vitamins?.vitamin_b6 || 0) * multiplier)).toFixed(1)}mg`, pct: dv(nutrition.daily_values?.vitamin_b6) },
                  { label: "Folate", val: `${val(nutrition.vitamins?.folate)}mcg`, pct: dv(nutrition.daily_values?.folate) },
                ].map(m => (
                  <div key={m.label} className="flex items-center justify-between py-1.5 border-b border-gray-50 text-xs">
                    <span className="text-gray-500">{m.label}</span>
                    <span className="text-right">
                      <span className="font-medium text-gray-900">{m.val}</span>
                      <span className="text-gray-400 ml-1">{m.pct}%</span>
                    </span>
                  </div>
                ))}
              </div>
              <div>
                {[
                  { label: "Calcium", val: `${val(nutrition.minerals?.calcium)}mg`, pct: dv(nutrition.daily_values?.calcium) },
                  { label: "Iron", val: `${(((nutrition.minerals?.iron || 0) * multiplier)).toFixed(1)}mg`, pct: dv(nutrition.daily_values?.iron) },
                  { label: "Potassium", val: `${val(nutrition.minerals?.potassium)}mg`, pct: dv(nutrition.daily_values?.potassium) },
                  { label: "Magnesium", val: `${val(nutrition.minerals?.magnesium)}mg`, pct: dv(nutrition.daily_values?.magnesium) },
                  { label: "Zinc", val: `${(((nutrition.minerals?.zinc || 0) * multiplier)).toFixed(1)}mg`, pct: dv(nutrition.daily_values?.zinc) },
                  { label: "Phosphorus", val: `${val(nutrition.minerals?.phosphorus)}mg`, pct: dv(nutrition.daily_values?.phosphorus) },
                ].map(m => (
                  <div key={m.label} className="flex items-center justify-between py-1.5 border-b border-gray-50 text-xs">
                    <span className="text-gray-500">{m.label}</span>
                    <span className="text-right">
                      <span className="font-medium text-gray-900">{m.val}</span>
                      <span className="text-gray-400 ml-1">{m.pct}%</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-3">AI-estimated based on ingredients. Not a substitute for professional dietary advice.</p>
          </div>
        </div>
      )}
    </div>
  )
}