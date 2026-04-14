"use client"
import React, { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Navbar from "@/app/components/Navbar"

function getWeekDates(date: Date) {
  const day = date.getDay()
  const diff = date.getDate() - day
  const sunday = new Date(date.setDate(diff))
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday)
    d.setDate(sunday.getDate() + i)
    return d
  })
}

function formatDate(date: Date) {
  return date.toISOString().split("T")[0]
}

function formatDateDisplay(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function isToday(date: Date) {
  const today = new Date()
  return date.toDateString() === today.toDateString()
}

export default function MealPlannerPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [weekDates, setWeekDates] = useState<Date[]>([])
  const [meals, setMeals] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [cookbooks, setCookbooks] = useState<any[]>([])
  const [allRecipes, setAllRecipes] = useState<any[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [showGroceryModal, setShowGroceryModal] = useState(false)
  const [selectedDate, setSelectedDate] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("")
  const [selectedCookbook, setSelectedCookbook] = useState("")
  const [newCategoryName, setNewCategoryName] = useState("")
  const [groceryList, setGroceryList] = useState<any>({})
  const [generatingGrocery, setGeneratingGrocery] = useState(false)
  const [generatingNutrition, setGeneratingNutrition] = useState(false)
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set())
  const [liveSync, setLiveSync] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [recipeSearch, setRecipeSearch] = useState("")
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("")
  const [groceryListName, setGroceryListName] = useState("")
  const [savingGroceryList, setSavingGroceryList] = useState(false)
  const [grocerySaved, setGrocerySaved] = useState(false)

  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login?code=returning")
    if (status === "authenticated") {
      fetchCategories()
      fetchCookbooks()
      const saved = localStorage.getItem("smartflavr_live_sync")
      if (saved === "true") setLiveSync(true)
    }
  }, [status])

  useEffect(() => {
    const dates = getWeekDates(new Date(currentWeek))
    setWeekDates(dates)
  }, [currentWeek])

  useEffect(() => {
    if (weekDates.length > 0) fetchMeals()
  }, [weekDates])

  useEffect(() => {
    if (selectedCookbook) fetchRecipesForCookbook(selectedCookbook)
  }, [selectedCookbook])

  async function fetchMeals() {
    const start = formatDate(weekDates[0])
    const end = formatDate(weekDates[6])
    const res = await fetch(`/api/meal-plans?start=${start}&end=${end}`)
    const data = await res.json()
    setMeals(data.meals || [])
  }

  async function fetchCategories() {
    const res = await fetch("/api/meal-plan-categories")
    const data = await res.json()
    setCategories(data.categories || [])
  }

  async function fetchCookbooks() {
    const res = await fetch("/api/cookbooks")
    const data = await res.json()
    setCookbooks(data.cookbooks || [])
  }

  async function fetchRecipesForCookbook(cookbookId: string) {
    const res = await fetch(`/api/recipes?cookbook_id=${cookbookId}`)
    const data = await res.json()
    setAllRecipes(data.recipes || [])
  }

  async function generateMissingNutrition() {
    const missingNutrition = meals.filter(m => !m.nutrition && m.ingredients)
    if (missingNutrition.length === 0) {
      alert("All recipes already have nutrition data!")
      return
    }
    setGeneratingNutrition(true)
    for (const meal of missingNutrition) {
      await fetch("/api/nutrition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipe_id: meal.recipe_id,
          ingredients: meal.ingredients,
          servings: parseInt(meal.servings) || 1,
        }),
      })
    }
    await fetchMeals()
    setGeneratingNutrition(false)
  }

  async function syncMealsToCalendar(mealsToSync: any[]) {
    const unsynced = mealsToSync.filter(m => !m.synced_to_calendar)
    if (unsynced.length === 0) return
    await fetch("/api/google-calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meals: unsynced }),
    })
  }

  async function deleteMealFromCalendar(meal: any) {
    if (!meal.gcal_event_id) return
    await fetch("/api/google-calendar/event", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_id: meal.gcal_event_id, meal_id: meal.id }),
    })
  }

  async function clearAllCalendarEvents() {
    if (weekDates.length === 0) return
    const start = formatDate(weekDates[0])
    const end = formatDate(weekDates[6])
    await fetch("/api/google-calendar", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ start, end }),
    })
  }

  async function toggleLiveSync() {
    const next = !liveSync
    setSyncing(true)

    if (next) {
      const start = formatDate(weekDates[0])
      const end = formatDate(weekDates[6])
      const res = await fetch(`/api/meal-plans?start=${start}&end=${end}`)
      const data = await res.json()
      const currentMeals = data.meals || []
      await syncMealsToCalendar(currentMeals)
      await fetchMeals()
    } else {
      await clearAllCalendarEvents()
      await fetchMeals()
    }

    setLiveSync(next)
    localStorage.setItem("smartflavr_live_sync", String(next))
    setSyncing(false)
  }

  async function addMeal(recipeId: string) {
    await fetch("/api/meal-plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipe_id: recipeId,
        meal_date: selectedDate,
        meal_type: selectedCategory,
      }),
    })

    setShowAddModal(false)
    setSelectedCookbook("")
    setAllRecipes([])
    setRecipeSearch("")
    setSelectedCategoryFilter("")

    if (liveSync) {
      const start = formatDate(weekDates[0])
      const end = formatDate(weekDates[6])
      const mealsRes = await fetch(`/api/meal-plans?start=${start}&end=${end}`)
      const mealsData = await mealsRes.json()
      await syncMealsToCalendar(mealsData.meals || [])
    }

    fetchMeals()
  }

  async function removeMeal(meal: any) {
    if (liveSync && meal.gcal_event_id) {
      await deleteMealFromCalendar(meal)
    }

    await fetch("/api/meal-plans", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: meal.id }),
    })

    fetchMeals()
  }

  async function addCategory() {
    if (!newCategoryName.trim()) return
    await fetch("/api/meal-plan-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCategoryName }),
    })
    setNewCategoryName("")
    setShowCategoryModal(false)
    fetchCategories()
  }

  async function deleteCategory(id: string) {
    if (!confirm("Delete this category? Meals in this category will also be removed.")) return
    await fetch("/api/meal-plan-categories", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
    fetchCategories()
    fetchMeals()
  }

  async function generateGroceryList() {
    setGeneratingGrocery(true)
    setGrocerySaved(false)

    // Auto-name based on week
    const weekStart = weekDates[0]
    const autoName = `Week of ${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
    setGroceryListName(autoName)

    const start = formatDate(weekDates[0])
    const end = formatDate(weekDates[6])
    const res = await fetch(`/api/meal-plans?start=${start}&end=${end}`)
    const data = await res.json()
    const weekMeals = data.meals || []

    const allIngredients: string[] = []
    weekMeals.forEach((meal: any) => {
      if (meal.ingredients) {
        meal.ingredients.split("\n").filter(Boolean).forEach((ing: string) => {
          allIngredients.push(ing.trim())
        })
      }
    })

    const aiRes = await fetch("/api/grocery-list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ingredients: allIngredients }),
    })
    const aiData = await aiRes.json()
    if (aiData.success) setGroceryList(aiData.list)
    setGeneratingGrocery(false)
    setShowGroceryModal(true)
  }

  async function saveGroceryList() {
    if (!groceryListName.trim()) return
    setSavingGroceryList(true)

    const items: string[] = []
    Object.entries(groceryList).forEach(([, groceryItems]: any) => {
      groceryItems.forEach((item: any) => {
        items.push(`${item.amount} ${item.item}`.trim())
      })
    })

    await fetch("/api/grocery-lists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: groceryListName, items }),
    })

    setSavingGroceryList(false)
    setGrocerySaved(true)
  }

  function getMealsForCell(date: Date, category: string) {
    const dateStr = formatDate(date)
    return meals.filter(m => m.meal_date?.split("T")[0] === dateStr && m.meal_type === category)
  }

  function getDayNutrition(date: Date) {
    const dateStr = formatDate(date)
    const dayMeals = meals.filter(m => m.meal_date?.split("T")[0] === dateStr)
    let calories = 0, protein = 0, carbs = 0, fat = 0
    dayMeals.forEach((meal: any) => {
      if (meal.nutrition) {
        const n = typeof meal.nutrition === "string" ? JSON.parse(meal.nutrition) : meal.nutrition
        calories += n.calories || 0
        protein += n.protein || 0
        carbs += n.carbs || 0
        fat += n.fat || 0
      }
    })
    return { calories: Math.round(calories), protein: Math.round(protein), carbs: Math.round(carbs), fat: Math.round(fat) }
  }

  function getWeekAverages() {
    let totalCal = 0, totalProtein = 0, totalCarbs = 0, totalFat = 0, daysWithData = 0
    weekDates.forEach(date => {
      const n = getDayNutrition(date)
      if (n.calories > 0) {
        totalCal += n.calories
        totalProtein += n.protein
        totalCarbs += n.carbs
        totalFat += n.fat
        daysWithData++
      }
    })
    if (daysWithData === 0) return null
    return {
      calories: Math.round(totalCal / daysWithData),
      protein: Math.round(totalProtein / daysWithData),
      carbs: Math.round(totalCarbs / daysWithData),
      fat: Math.round(totalFat / daysWithData),
      daysWithData
    }
  }

  function prevWeek() {
    const d = new Date(currentWeek)
    d.setDate(d.getDate() - 7)
    setCurrentWeek(d)
  }

  function nextWeek() {
    const d = new Date(currentWeek)
    d.setDate(d.getDate() + 7)
    setCurrentWeek(d)
  }

  const weekAvg = getWeekAverages()
  const totalMealsPlanned = meals.length
  const hasMissingNutrition = meals.some(m => !m.nutrition && m.ingredients)

  const filteredRecipes = allRecipes.filter((r: any) => {
    const matchesSearch = r.title.toLowerCase().includes(recipeSearch.toLowerCase())
    const matchesCategory = !selectedCategoryFilter || r.category_name === selectedCategoryFilter
    return matchesSearch && matchesCategory
  })

  const recipeCategories = Array.from(new Set(allRecipes.map((r: any) => r.category_name).filter(Boolean)))

  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-7xl mx-auto px-6 py-8">

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button onClick={prevWeek} className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 bg-white">←</button>
            <div>
              <h1 className="text-lg font-medium text-gray-900">Meal planner</h1>
              <p className="text-xs text-gray-400">
                {weekDates.length > 0 && `${formatDateDisplay(weekDates[0])} – ${formatDateDisplay(weekDates[6])}, ${weekDates[0]?.getFullYear()}`}
              </p>
            </div>
            <button onClick={nextWeek} className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 bg-white">→</button>
          </div>
          <div className="flex gap-3 items-center flex-wrap justify-end">
            <button
              onClick={() => setShowCategoryModal(true)}
              className="border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-500 hover:bg-gray-50 bg-white">
              + Category
            </button>
            {hasMissingNutrition && (
              <button
                onClick={generateMissingNutrition}
                disabled={generatingNutrition}
                className="border border-orange-200 text-orange-500 px-4 py-2 rounded-xl text-sm font-medium hover:bg-orange-50 disabled:opacity-50 transition bg-white">
                {generatingNutrition ? "Generating..." : "✨ Generate missing nutrition"}
              </button>
            )}
            <button
              onClick={generateGroceryList}
              disabled={generatingGrocery || meals.length === 0}
              className="bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-orange-600 disabled:opacity-50 transition">
              {generatingGrocery ? "Generating..." : "Grocery list"}
            </button>
            <button
              onClick={toggleLiveSync}
              disabled={syncing}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition border ${liveSync ? "bg-blue-500 text-white border-blue-500 hover:bg-blue-600" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`}>
              <div className={`w-3 h-3 rounded-full ${liveSync ? "bg-white" : "bg-gray-300"}`}/>
              {syncing ? "Syncing..." : liveSync ? "Google Calendar: On" : "Google Calendar: Off"}
            </button>
          </div>
        </div>

        {weekAvg && (
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[
              { label: "Avg daily calories", val: weekAvg.calories.toLocaleString() },
              { label: "Avg daily protein", val: `${weekAvg.protein}g` },
              { label: "Meals planned", val: totalMealsPlanned },
              { label: "Days planned", val: weekAvg.daysWithData },
            ].map(s => (
              <div key={s.label} className="bg-white border border-gray-100 rounded-2xl p-4">
                <div className="text-xl font-medium text-gray-900">{s.val}</div>
                <div className="text-xs text-gray-400 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden mb-6">
          <div className="grid" style={{ gridTemplateColumns: `120px repeat(7, 1fr)` }}>
            <div className="p-3 border-b border-r border-gray-100"/>
            {weekDates.map((date, i) => (
              <div key={i} className={`p-3 border-b border-r border-gray-100 text-center last:border-r-0 ${isToday(date) ? "bg-orange-50" : ""}`}>
                <div className="text-xs font-medium text-gray-500">{DAYS[i]}</div>
                <div className={`text-sm font-medium mt-0.5 ${isToday(date) ? "text-orange-500" : "text-gray-900"}`}>
                  {date.getDate()}
                </div>
              </div>
            ))}

            {categories.map((cat: any) => (
              <React.Fragment key={cat.id}>
                <div className="p-3 border-b border-r border-gray-100 flex items-center justify-between group">
                  <span className="text-xs font-medium text-gray-600">{cat.name}</span>
                  <button
                    onClick={() => deleteCategory(cat.id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 text-xs transition">
                    ✕
                  </button>
                </div>
                {weekDates.map((date, i) => {
                  const cellMeals = getMealsForCell(date, cat.name)
                  return (
                    <div
                      key={`${cat.id}-${i}`}
                      className={`p-2 border-b border-r border-gray-100 last:border-r-0 min-h-16 ${isToday(date) ? "bg-orange-50/30" : ""}`}>
                      <div className="space-y-1">
                        {cellMeals.map((meal: any) => (
                          <div key={meal.id} className="bg-orange-50 border border-orange-100 rounded-lg p-1.5 group relative">
                            <div className="text-xs font-medium text-orange-800 leading-tight pr-4">{meal.recipe_title}</div>
                            {meal.nutrition && (() => {
                              const n = typeof meal.nutrition === "string" ? JSON.parse(meal.nutrition) : meal.nutrition
                              return <div className="text-xs text-orange-500 mt-0.5">{Math.round(n.calories)} cal</div>
                            })()}
                            {meal.synced_to_calendar === 1 && (
                              <div className="text-xs text-blue-400 mt-0.5">📅 Synced</div>
                            )}
                            <button
                              onClick={() => removeMeal(meal)}
                              className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-orange-300 hover:text-red-400 text-xs transition">
                              ✕
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => {
                            setSelectedDate(formatDate(date))
                            setSelectedCategory(cat.name)
                            setShowAddModal(true)
                          }}
                          className="w-full text-center text-gray-300 hover:text-orange-400 text-lg leading-none py-1 transition">
                          +
                        </button>
                      </div>
                    </div>
                  )
                })}
              </React.Fragment>
            ))}

            <div className="p-3 border-r border-gray-100">
              <span className="text-xs font-medium text-gray-400">Totals</span>
            </div>
            {weekDates.map((date, i) => {
              const n = getDayNutrition(date)
              return (
                <div key={i} className={`p-2 border-r border-gray-100 last:border-r-0 ${isToday(date) ? "bg-orange-50/30" : ""}`}>
                  {n.calories > 0 ? (
                    <div className="bg-gray-50 rounded-lg p-2 text-center">
                      <div className="text-xs font-medium text-gray-900">{n.calories.toLocaleString()} cal</div>
                      <div className="text-xs text-gray-400 mt-0.5">P:{n.protein}g C:{n.carbs}g F:{n.fat}g</div>
                    </div>
                  ) : (
                    <div className="text-center text-xs text-gray-300">—</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 max-h-[85vh] overflow-y-auto">
            <h2 className="text-lg font-medium mb-1">Add recipe</h2>
            <p className="text-sm text-gray-400 mb-4">{selectedCategory} · {selectedDate}</p>

            <div className="mb-3">
              <label className="text-sm text-gray-500 mb-1 block">Cookbook</label>
              <select
                value={selectedCookbook}
                onChange={e => { setSelectedCookbook(e.target.value); setRecipeSearch(""); setSelectedCategoryFilter("") }}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none">
                <option value="">Choose a cookbook...</option>
                {cookbooks.map((b: any) => (
                  <option key={b.id} value={b.id}>{b.cover_emoji} {b.title}</option>
                ))}
              </select>
            </div>

            {selectedCookbook && (
              <div className="flex gap-2 mb-3">
                <input
                  value={recipeSearch}
                  onChange={e => setRecipeSearch(e.target.value)}
                  placeholder="Search recipes..."
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none"
                />
                {recipeCategories.length > 0 && (
                  <select
                    value={selectedCategoryFilter}
                    onChange={e => setSelectedCategoryFilter(e.target.value)}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none">
                    <option value="">All</option>
                    {recipeCategories.map((cat: any) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {filteredRecipes.length > 0 && (
              <div className="space-y-2">
                {filteredRecipes.map((r: any) => (
                  <div
                    key={r.id}
                    onClick={() => addMeal(r.id)}
                    className="flex items-center gap-3 p-3 border border-gray-100 rounded-xl cursor-pointer hover:bg-orange-50 hover:border-orange-200 transition">
                    {r.image_url ? (
                      <img src={r.image_url} className="w-10 h-10 rounded-lg object-cover flex-shrink-0"/>
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                        <span style={{ fontSize: "16px" }}>🍽️</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{r.title}</div>
                      <div className="flex gap-2 text-xs text-gray-400 mt-0.5 flex-wrap">
                        {r.category_name && (
                          <span className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">{r.category_name}</span>
                        )}
                        {r.prep_time && <span>⏱ {r.prep_time}</span>}
                        {r.servings && <span>👤 {r.servings}</span>}
                        {r.nutrition && (() => {
                          const n = typeof r.nutrition === "string" ? JSON.parse(r.nutrition) : r.nutrition
                          return <span>🔥 {Math.round(n.calories)} cal</span>
                        })()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedCookbook && filteredRecipes.length === 0 && allRecipes.length > 0 && (
              <div className="text-center py-8 text-sm text-gray-400">No recipes match your search</div>
            )}

            {selectedCookbook && allRecipes.length === 0 && (
              <div className="text-center py-8 text-sm text-gray-400">No recipes in this cookbook</div>
            )}

            <button
              onClick={() => {
                setShowAddModal(false)
                setSelectedCookbook("")
                setAllRecipes([])
                setRecipeSearch("")
                setSelectedCategoryFilter("")
              }}
              className="w-full border border-gray-200 rounded-xl py-2 text-sm text-gray-500 hover:bg-gray-50 mt-4">
              Cancel
            </button>
          </div>
        </div>
      )}

      {showCategoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4">
            <h2 className="text-lg font-medium mb-4">Manage categories</h2>
            <div className="space-y-2 mb-4">
              {categories.map((cat: any) => (
                <div key={cat.id} className="flex items-center justify-between py-2 border-b border-gray-50">
                  <span className="text-sm text-gray-700">{cat.name}</span>
                  <button
                    onClick={() => deleteCategory(cat.id)}
                    className="text-xs text-red-400 hover:text-red-600">
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mb-4">
              <input
                value={newCategoryName}
                onChange={e => setNewCategoryName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addCategory()}
                placeholder="New category name..."
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none"
              />
              <button
                onClick={addCategory}
                className="px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600">
                Add
              </button>
            </div>
            <button
              onClick={() => setShowCategoryModal(false)}
              className="w-full border border-gray-200 rounded-xl py-2 text-sm text-gray-500 hover:bg-gray-50">
              Done
            </button>
          </div>
        </div>
      )}

      {showGroceryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium">Grocery list</h2>
              <button
                onClick={() => {
                  const text = Object.entries(groceryList).map(([cat, items]: any) =>
                    `${cat}\n${items.map((i: any) => `- ${i.amount} ${i.item}`).join("\n")}`
                  ).join("\n\n")
                  navigator.clipboard.writeText(text)
                  alert("Copied to clipboard!")
                }}
                className="px-3 py-1 border border-gray-200 rounded-lg text-xs text-gray-500 hover:bg-gray-50">
                Copy
              </button>
            </div>
            <p className="text-xs text-gray-400 mb-4">Based on your meal plan for this week</p>

            {Object.entries(groceryList).map(([category, items]: any) => (
              <div key={category} className="mb-4">
                <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">{category}</div>
                <div className="space-y-1">
                  {items.map((item: any, i: number) => {
                    const key = `${category}-${i}`
                    return (
                      <div
                        key={i}
                        onClick={() => {
                          const next = new Set(checkedItems)
                          if (next.has(key)) next.delete(key)
                          else next.add(key)
                          setCheckedItems(next)
                        }}
                        className={`flex items-center gap-3 py-2 border-b border-gray-50 cursor-pointer ${checkedItems.has(key) ? "opacity-50" : ""}`}>
                        <div className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center ${checkedItems.has(key) ? "bg-orange-500 border-orange-500" : "border-gray-300"}`}>
                          {checkedItems.has(key) && <span className="text-white text-xs">✓</span>}
                        </div>
                        <span className={`text-sm flex-1 ${checkedItems.has(key) ? "line-through text-gray-400" : "text-gray-900"}`}>
                          {item.item}
                        </span>
                        <span className="text-xs text-gray-400">{item.amount}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}

            <div className="border-t border-gray-100 pt-4 mt-2">
              <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Save to My Grocery Lists</div>
              <div className="flex gap-2">
                <input
                  value={groceryListName}
                  onChange={e => setGroceryListName(e.target.value)}
                  placeholder="List name..."
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none"
                />
                <button
                  onClick={saveGroceryList}
                  disabled={savingGroceryList || grocerySaved || !groceryListName.trim()}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition ${grocerySaved ? "bg-green-500 text-white" : "bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50"}`}>
                  {savingGroceryList ? "Saving..." : grocerySaved ? "✓ Saved!" : "Save"}
                </button>
              </div>
            </div>

            <button
              onClick={() => setShowGroceryModal(false)}
              className="w-full border border-gray-200 rounded-xl py-2 text-sm text-gray-500 hover:bg-gray-50 mt-4">
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}