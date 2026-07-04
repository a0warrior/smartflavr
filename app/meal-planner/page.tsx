"use client"
import React, { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Navbar from "@/app/components/Navbar"
import MealPlanSyncModal from "@/app/components/MealPlanSyncModal"
import { toast } from "@/app/components/Toast"
import { PageSkeleton } from "@/app/components/Skeletons"
import { SparkleIcon, PlateIcon, ClockIcon, UserIcon, FlameIcon } from "@/app/components/Icons"
import { pulse, subscribe } from "@/lib/firebase"
import { DndContext, PointerSensor, useSensor, useSensors, useDraggable, useDroppable, DragEndEvent } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"

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

function DraggableMeal({ meal, onRemove }: { meal: any, onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `meal-${meal.id}`, data: { meal } })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), zIndex: isDragging ? 40 : undefined }}
      {...listeners}
      {...attributes}
      className={`bg-orange-50 border border-orange-100 rounded-lg p-1.5 group relative cursor-grab active:cursor-grabbing touch-none ${isDragging ? "opacity-80 shadow-lg ring-2 ring-orange-300" : ""}`}>
      <div className="text-xs font-medium text-orange-800 leading-tight pr-4">{meal.recipe_title}</div>
      {meal.nutrition && (() => {
        const n = typeof meal.nutrition === "string" ? JSON.parse(meal.nutrition) : meal.nutrition
        return <div className="text-xs text-orange-500 mt-0.5">{Math.round(n.calories)} cal</div>
      })()}
      {meal.synced_to_calendar === 1 && <div className="text-xs text-blue-400 mt-0.5">Synced</div>}
      <button onClick={onRemove} className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-orange-300 hover:text-red-400 text-xs transition">×</button>
    </div>
  )
}

function DroppableCell({ date, category, isTodayCell, children }: { date: string, category: string, isTodayCell: boolean, children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `cell-${date}-${category}`, data: { date, category } })
  return (
    <div ref={setNodeRef} className={`p-2 border-b border-r border-gray-100 last:border-r-0 min-h-16 transition-colors ${isOver ? "bg-orange-100/70 ring-1 ring-inset ring-orange-300" : isTodayCell ? "bg-orange-50/30" : ""}`}>
      {children}
    </div>
  )
}

export default function MealPlannerPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [currentWeek, setCurrentWeek] = useState(new Date())
  const [weekDates, setWeekDates] = useState<Date[]>([])
  const [meals, setMeals] = useState<any[]>([])
  const [collaboratorMeals, setCollaboratorMeals] = useState<any[]>([])
  const [showSyncModal, setShowSyncModal] = useState(false)
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
  const [saveMode, setSaveMode] = useState<"new" | "existing">("new")
  const [existingLists, setExistingLists] = useState<any[]>([])
  const [selectedExistingList, setSelectedExistingList] = useState("")
  const [mobileDate, setMobileDate] = useState<Date>(new Date())
  const [planStatus, setPlanStatus] = useState<any>(null)
  const [userId, setUserId] = useState<number | null>(null)
  const [goals, setGoals] = useState<any>(null)
  const [showGoalsModal, setShowGoalsModal] = useState(false)
  const [goalInputs, setGoalInputs] = useState({ calories: "", protein: "", carbs: "", fat: "" })
  const [copyingWeek, setCopyingWeek] = useState(false)

  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login?code=returning")
    if (status === "authenticated") {
      fetchCategories()
      fetchCookbooks()
      fetchExistingLists()
      fetch("/api/subscription").then(r => r.ok ? r.json() : null).then(d => d && setPlanStatus(d)).catch(() => {})
      fetch("/api/profile").then(r => r.json()).then(d => { if (d.user?.id) setUserId(d.user.id) }).catch(() => {})
      fetch("/api/nutrition-goals").then(r => r.ok ? r.json() : null).then(d => d && setGoals(d.goals)).catch(() => {})
      const saved = localStorage.getItem("smartflavr_live_sync")
      if (saved === "true") setLiveSync(true)
    }
  }, [status])

  useEffect(() => {
    const dates = getWeekDates(new Date(currentWeek))
    setWeekDates(dates)
  }, [currentWeek])

  useEffect(() => {
    if (weekDates.length > 0) {
      fetchMeals()
      const inWeek = weekDates.some(d => d.toDateString() === mobileDate.toDateString())
      if (!inWeek) setMobileDate(weekDates[0])
    }
  }, [weekDates])

  useEffect(() => {
    if (selectedCookbook) fetchRecipesForCookbook(selectedCookbook)
  }, [selectedCookbook])

  useEffect(() => {
    if (!userId) return
    return subscribe(`/updates/users/${userId}/mealplan`, fetchMeals)
  }, [userId])

  async function fetchMeals() {
    const start = formatDate(weekDates[0])
    const end = formatDate(weekDates[6])
    const res = await fetch(`/api/meal-plans?start=${start}&end=${end}`)
    const data = await res.json()
    setMeals(data.meals || [])
    setCollaboratorMeals(data.collaboratorMeals || [])
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

  async function fetchExistingLists() {
    const res = await fetch("/api/grocery-lists")
    const data = await res.json()
    setExistingLists(data.lists || [])
  }

  async function fetchRecipesForCookbook(cookbookId: string) {
    const res = await fetch(`/api/recipes?cookbook_id=${cookbookId}`)
    const data = await res.json()
    setAllRecipes(data.recipes || [])
  }


  async function generateMissingNutrition() {
    if (!planStatus?.canUseAI) return
    const missingNutrition = meals.filter((m: any) => !m.nutrition && m.ingredients)
    if (missingNutrition.length === 0) return
    setGeneratingNutrition(true)
    for (const meal of missingNutrition) {
      await fetch("/api/nutrition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipe_id: meal.recipe_id,
          title: meal.title,
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
    if (userId) pulse(`/updates/users/${userId}/mealplan`)
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
    if (userId) pulse(`/updates/users/${userId}/mealplan`)
  }

  async function moveMeal(meal: any, newDate: string, newCategory: string) {
    const oldDate = meal.meal_date?.split("T")[0]
    if (oldDate === newDate && meal.meal_type === newCategory) return
    // Optimistic update so the card lands instantly
    setMeals(prev => prev.map(m => m.id === meal.id ? { ...m, meal_date: newDate, meal_type: newCategory, synced_to_calendar: 0, gcal_event_id: null } : m))
    if (liveSync && meal.gcal_event_id) await deleteMealFromCalendar(meal)
    await fetch("/api/meal-plans", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: meal.id, meal_date: newDate, meal_type: newCategory }),
    })
    if (liveSync) {
      const start = formatDate(weekDates[0])
      const end = formatDate(weekDates[6])
      const res = await fetch(`/api/meal-plans?start=${start}&end=${end}`)
      const data = await res.json()
      await syncMealsToCalendar(data.meals || [])
    }
    fetchMeals()
    if (userId) pulse(`/updates/users/${userId}/mealplan`)
  }

  function handleDragEnd(event: DragEndEvent) {
    const meal = event.active?.data?.current?.meal
    const target = event.over?.data?.current as { date: string, category: string } | undefined
    if (!meal || !target) return
    moveMeal(meal, target.date, target.category)
  }

  async function copyLastWeek() {
    setCopyingWeek(true)
    const prevStart = new Date(weekDates[0]); prevStart.setDate(prevStart.getDate() - 7)
    const prevEnd = new Date(weekDates[6]); prevEnd.setDate(prevEnd.getDate() - 7)
    const res = await fetch(`/api/meal-plans?start=${formatDate(prevStart)}&end=${formatDate(prevEnd)}`)
    const data = await res.json()
    const prevMeals = data.meals || []
    if (prevMeals.length === 0) {
      toast.info("Last week has no meals to copy.")
      setCopyingWeek(false)
      return
    }
    if (meals.length > 0 && !confirm("This week already has meals. Copy last week's meals on top of them?")) {
      setCopyingWeek(false)
      return
    }
    for (const m of prevMeals) {
      const base = new Date(`${m.meal_date.split("T")[0]}T00:00:00Z`)
      base.setUTCDate(base.getUTCDate() + 7)
      await fetch("/api/meal-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipe_id: m.recipe_id, meal_date: base.toISOString().split("T")[0], meal_type: m.meal_type }),
      })
    }
    await fetchMeals()
    toast.success(`Copied ${prevMeals.length} meal${prevMeals.length !== 1 ? "s" : ""} from last week!`)
    if (userId) pulse(`/updates/users/${userId}/mealplan`)
    setCopyingWeek(false)
  }

  function openGoalsModal() {
    setGoalInputs({
      calories: goals?.calories ? String(goals.calories) : "",
      protein: goals?.protein ? String(goals.protein) : "",
      carbs: goals?.carbs ? String(goals.carbs) : "",
      fat: goals?.fat ? String(goals.fat) : "",
    })
    setShowGoalsModal(true)
  }

  async function saveGoals() {
    const parsed = {
      calories: parseInt(goalInputs.calories) || 0,
      protein: parseInt(goalInputs.protein) || 0,
      carbs: parseInt(goalInputs.carbs) || 0,
      fat: parseInt(goalInputs.fat) || 0,
    }
    const hasAny = Object.values(parsed).some(v => v > 0)
    const next = hasAny ? parsed : null
    await fetch("/api/nutrition-goals", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goals: next }),
    })
    setGoals(next)
    setShowGoalsModal(false)
    toast.success(hasAny ? "Nutrition goals saved!" : "Nutrition goals cleared.")
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
    if (!planStatus?.canUseAI) return
    setGeneratingGrocery(true)
    setGrocerySaved(false)
    setSaveMode("new")
    setSelectedExistingList("")

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
    await fetchExistingLists()
    setShowGroceryModal(true)
  }

  async function saveGroceryList() {
    setSavingGroceryList(true)

    const items: string[] = []
    Object.entries(groceryList).forEach(([, groceryItems]: any) => {
      groceryItems.forEach((item: any) => {
        items.push(`${item.amount} ${item.item}`.trim())
      })
    })

    if (saveMode === "new") {
      if (!groceryListName.trim()) { setSavingGroceryList(false); return }
      await fetch("/api/grocery-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: groceryListName, items }),
      })
    } else {
      if (!selectedExistingList) { setSavingGroceryList(false); return }
      await fetch("/api/grocery-lists", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: parseInt(selectedExistingList), addItems: items }),
      })
    }

    setSavingGroceryList(false)
    setGrocerySaved(true)
    await fetchExistingLists()
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
  const hasMissingNutrition = meals.some((m: any) => !m.nutrition && m.ingredients)

  const filteredRecipes = allRecipes.filter((r: any) => {
    const matchesSearch = r.title.toLowerCase().includes(recipeSearch.toLowerCase())
    const matchesCategory = !selectedCategoryFilter || r.category_name === selectedCategoryFilter
    return matchesSearch && matchesCategory
  })

  const recipeCategories = Array.from(new Set(allRecipes.map((r: any) => r.category_name).filter(Boolean)))

  if (status === "loading") {
    return <PageSkeleton />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      {/* ── SHARED HEADER ── */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 pt-6 pb-4">
        {/* Week nav row */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-3">
          <div className="flex items-center justify-between md:justify-start md:gap-3">
            <button onClick={prevWeek} className="w-9 h-9 flex items-center justify-center border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50 bg-white text-base flex-shrink-0">←</button>
            <div className="text-center md:text-left">
              <h1 className="text-base font-semibold text-gray-900">Meal Planner</h1>
              <p className="text-xs text-gray-400">
                {weekDates.length > 0 && `${formatDateDisplay(weekDates[0])} – ${formatDateDisplay(weekDates[6])}`}
              </p>
            </div>
            <button onClick={nextWeek} className="w-9 h-9 flex items-center justify-center border border-gray-200 rounded-xl text-gray-500 hover:bg-gray-50 bg-white text-base flex-shrink-0">→</button>
          </div>
          {/* Desktop-only action buttons */}
          <div className="hidden md:flex gap-3 items-center flex-wrap justify-end">
            <button onClick={() => setShowCategoryModal(true)} className="border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-500 hover:bg-gray-50 bg-white">+ Category</button>
            <button onClick={copyLastWeek} disabled={copyingWeek} title="Copy last week's meals into this week" className="border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-500 hover:bg-gray-50 bg-white disabled:opacity-50">{copyingWeek ? "Copying..." : "Copy last week"}</button>
            <button onClick={openGoalsModal} title="Set daily calorie and macro targets" className="border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-500 hover:bg-gray-50 bg-white">Goals</button>
            <button onClick={() => setShowSyncModal(true)} title="Invite a friend to see each other's meal plans" className="border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-500 hover:bg-gray-50 bg-white">Collaborate</button>
            {hasMissingNutrition && (
              <button onClick={generateMissingNutrition} disabled={!planStatus?.canUseAI || generatingNutrition} title={!planStatus?.canUseAI ? "AI limit reached for this week" : undefined} className="flex items-center gap-1.5 border border-orange-200 text-orange-500 px-4 py-2 rounded-xl text-sm font-medium hover:bg-orange-50 disabled:opacity-50 transition bg-white">
                <SparkleIcon size={13} />{generatingNutrition ? "Generating..." : "Generate nutrition"}
              </button>
            )}
            <button onClick={generateGroceryList} disabled={!planStatus?.canUseAI || generatingGrocery || meals.length === 0} title={!planStatus?.canUseAI ? "AI limit reached for this week" : undefined} className="bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-orange-600 disabled:opacity-50 transition">
              {generatingGrocery ? "Generating..." : "Grocery list"}
            </button>
            <button onClick={toggleLiveSync} disabled={syncing} title="Sync your meals to Google Calendar" className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition border ${liveSync ? "bg-blue-500 text-white border-blue-500 hover:bg-blue-600" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-50"}`}>
              <div className={`w-3 h-3 rounded-full ${liveSync ? "bg-white" : "bg-gray-300"}`}/>
              {syncing ? "Syncing..." : liveSync ? "Calendar: On" : "Calendar: Off"}
            </button>
          </div>
          {/* Mobile-only quick actions */}
          <div className="flex md:hidden gap-2">
            <button onClick={generateGroceryList} disabled={!planStatus?.canUseAI || generatingGrocery || meals.length === 0} className="flex-1 py-2.5 bg-orange-500 text-white rounded-xl text-xs font-semibold hover:bg-orange-600 disabled:opacity-50 transition">
              {generatingGrocery ? "..." : "Grocery"}
            </button>
            <button onClick={toggleLiveSync} disabled={syncing} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition border ${liveSync ? "bg-blue-500 text-white border-blue-500" : "bg-white text-gray-500 border-gray-200"}`}>
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${liveSync ? "bg-white" : "bg-gray-300"}`}/>
              {syncing ? "..." : liveSync ? "Calendar: On" : "Calendar: Off"}
            </button>
            <button onClick={() => setShowSyncModal(true)} className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-white text-gray-500 border border-gray-200">
              Collaborate
            </button>
          </div>
          {/* Mobile secondary actions */}
          <div className="flex md:hidden gap-2">
            <button onClick={copyLastWeek} disabled={copyingWeek} className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-white text-gray-500 border border-gray-200 disabled:opacity-50">
              {copyingWeek ? "Copying..." : "Copy last week"}
            </button>
            <button onClick={openGoalsModal} className="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-white text-gray-500 border border-gray-200">
              Goals
            </button>
          </div>
        </div>
      </div>

      {/* ── MOBILE VIEW ── */}
      <div className="md:hidden px-4 pb-8">

        {/* Day picker */}
        <div className="bg-white border border-gray-100 rounded-2xl p-3 mb-4">
          <div className="flex gap-1">
            {weekDates.map((date, i) => {
              const isSelected = date.toDateString() === mobileDate.toDateString()
              const isT = isToday(date)
              const dayCount = meals.filter(m => m.meal_date?.split("T")[0] === formatDate(date)).length
              return (
                <button
                  key={i}
                  onClick={() => setMobileDate(date)}
                  className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 rounded-xl transition ${
                    isSelected ? "bg-orange-500 text-white" : isT ? "bg-orange-50 text-orange-500" : "text-gray-500 hover:bg-gray-50"
                  }`}>
                  <span className="text-[10px] font-semibold uppercase">{DAYS[i]}</span>
                  <span className="text-base font-bold leading-tight">{date.getDate()}</span>
                  <span className={`w-1.5 h-1.5 rounded-full ${dayCount > 0 ? (isSelected ? "bg-white/70" : "bg-orange-400") : "bg-transparent"}`} />
                </button>
              )
            })}
          </div>
        </div>

        {/* Day nutrition summary */}
        {(() => {
          const n = getDayNutrition(mobileDate)
          if (n.calories === 0) return null
          const stats = [
            { label: "Cal", val: n.calories.toLocaleString(), current: n.calories, goal: goals?.calories },
            { label: "Protein", val: `${n.protein}g`, current: n.protein, goal: goals?.protein },
            { label: "Carbs", val: `${n.carbs}g`, current: n.carbs, goal: goals?.carbs },
            { label: "Fat", val: `${n.fat}g`, current: n.fat, goal: goals?.fat },
          ]
          return (
            <div className="grid grid-cols-4 gap-2 mb-4">
              {stats.map(s => {
                const over = s.goal > 0 && s.current > s.goal
                return (
                  <div key={s.label} className="bg-white border border-gray-100 rounded-xl p-2.5 text-center">
                    <div className={`text-sm font-bold ${s.goal > 0 ? (over ? "text-red-500" : "text-green-600") : "text-gray-900"}`}>{s.val}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5">{s.goal > 0 ? `of ${s.goal.toLocaleString()}` : s.label}</div>
                  </div>
                )
              })}
            </div>
          )
        })()}

        {/* Meal categories for selected day */}
        {categories.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-10 text-center">
            <p className="text-sm text-gray-400 mb-4">Add a meal category to get started — like Breakfast, Lunch, or Dinner.</p>
            <button onClick={() => setShowCategoryModal(true)} className="px-5 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-semibold hover:bg-orange-600 transition">+ Add Category</button>
          </div>
        ) : (
          <div className="space-y-3">
            {categories.map((cat: any) => {
              const cellMeals = getMealsForCell(mobileDate, cat.name)
              return (
                <div key={cat.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                    <span className="text-sm font-semibold text-gray-900">{cat.name}</span>
                    <button onClick={() => deleteCategory(cat.id)} className="text-gray-300 hover:text-red-400 text-lg leading-none transition px-1">×</button>
                  </div>
                  <div className="p-3 space-y-2">
                    {cellMeals.map((meal: any) => (
                      <div key={meal.id} className="flex items-center gap-3 bg-orange-50 border border-orange-100 rounded-xl px-3 py-2.5">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-orange-800 truncate">{meal.recipe_title}</p>
                          {meal.nutrition && (() => {
                            const n = typeof meal.nutrition === "string" ? JSON.parse(meal.nutrition) : meal.nutrition
                            return <p className="text-xs text-orange-400 mt-0.5">{Math.round(n.calories)} cal</p>
                          })()}
                        </div>
                        <button onClick={() => removeMeal(meal)} className="text-orange-300 hover:text-red-400 transition flex-shrink-0 text-lg leading-none px-1">×</button>
                      </div>
                    ))}
                    {collaboratorMeals.filter((m: any) => m.meal_date?.split("T")[0] === formatDate(mobileDate) && m.meal_type === cat.name).map((meal: any) => (
                      <div key={`collab-${meal.id}`} className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2.5">
                        {meal.partner_image ? (
                          <img src={meal.partner_image} className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-blue-400 flex items-center justify-center text-white text-[10px] flex-shrink-0">{meal.partner_name?.charAt(0)}</div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-blue-800 truncate">{meal.recipe_title}</p>
                          <p className="text-xs text-blue-400 mt-0.5">{meal.partner_name}</p>
                        </div>
                      </div>
                    ))}
                    <button
                      onClick={() => { setSelectedDate(formatDate(mobileDate)); setSelectedCategory(cat.name); setShowAddModal(true) }}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-gray-200 text-sm text-gray-400 hover:border-orange-300 hover:text-orange-400 hover:bg-orange-50 transition">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      Add meal
                    </button>
                  </div>
                </div>
              )
            })}
            <button
              onClick={() => setShowCategoryModal(true)}
              className="w-full py-3 rounded-2xl border border-dashed border-gray-200 text-sm text-gray-400 hover:border-orange-200 hover:text-orange-400 hover:bg-orange-50 transition">
              + Add category
            </button>
          </div>
        )}
      </div>

      {/* ── DESKTOP VIEW ── */}
      <div className="hidden md:block max-w-7xl mx-auto px-6 pb-8">

        {weekAvg && (
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[
              { label: goals?.calories ? `Avg daily calories · goal ${goals.calories.toLocaleString()}` : "Avg daily calories", val: weekAvg.calories.toLocaleString(), goal: goals?.calories, current: weekAvg.calories },
              { label: goals?.protein ? `Avg daily protein · goal ${goals.protein}g` : "Avg daily protein", val: `${weekAvg.protein}g`, goal: goals?.protein, current: weekAvg.protein },
              { label: "Meals planned", val: totalMealsPlanned, goal: 0, current: 0 },
              { label: "Days planned", val: weekAvg.daysWithData, goal: 0, current: 0 },
            ].map(s => (
              <div key={s.label} className="bg-white border border-gray-100 rounded-2xl p-4">
                <div className={`text-xl font-medium ${s.goal > 0 ? (s.current > s.goal ? "text-red-500" : "text-green-600") : "text-gray-900"}`}>{s.val}</div>
                <div className="text-xs text-gray-400 mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden mb-6">
          <DndContext sensors={dndSensors} onDragEnd={handleDragEnd}>
          <div className="grid" style={{ gridTemplateColumns: `120px repeat(7, 1fr)` }}>
            <div className="p-3 border-b border-r border-gray-100"/>
            {weekDates.map((date, i) => (
              <div key={i} className={`p-3 border-b border-r border-gray-100 text-center last:border-r-0 ${isToday(date) ? "bg-orange-50" : ""}`}>
                <div className="text-xs font-medium text-gray-500">{DAYS[i]}</div>
                <div className={`text-sm font-medium mt-0.5 ${isToday(date) ? "text-orange-500" : "text-gray-900"}`}>{date.getDate()}</div>
              </div>
            ))}

            {categories.map((cat: any) => (
              <React.Fragment key={cat.id}>
                <div className="p-3 border-b border-r border-gray-100 flex items-center justify-between group">
                  <span className="text-xs font-medium text-gray-600">{cat.name}</span>
                  <button onClick={() => deleteCategory(cat.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 text-xs transition">×</button>
                </div>
                {weekDates.map((date, i) => {
                  const cellMeals = getMealsForCell(date, cat.name)
                  return (
                    <DroppableCell key={`${cat.id}-${i}`} date={formatDate(date)} category={cat.name} isTodayCell={isToday(date)}>
                      <div className="space-y-1">
                        {cellMeals.map((meal: any) => (
                          <DraggableMeal key={meal.id} meal={meal} onRemove={() => removeMeal(meal)} />
                        ))}
                        {collaboratorMeals.filter((m: any) => m.meal_date?.split("T")[0] === formatDate(date) && m.meal_type === cat.name).map((meal: any) => (
                          <div key={`collab-${meal.id}`} className="bg-blue-50 border border-blue-100 rounded-lg p-1.5 relative">
                            <div className="flex items-center gap-1 mb-0.5">
                              {meal.partner_image ? (
                                <img src={meal.partner_image} className="w-3.5 h-3.5 rounded-full object-cover flex-shrink-0" />
                              ) : (
                                <div className="w-3.5 h-3.5 rounded-full bg-blue-400 flex items-center justify-center text-white text-[8px] flex-shrink-0">{meal.partner_name?.charAt(0)}</div>
                              )}
                              <span className="text-[10px] text-blue-400 truncate">{meal.partner_name}</span>
                            </div>
                            <div className="text-xs font-medium text-blue-800 leading-tight">{meal.recipe_title}</div>
                          </div>
                        ))}
                        <button onClick={() => { setSelectedDate(formatDate(date)); setSelectedCategory(cat.name); setShowAddModal(true) }} className="w-full text-center text-gray-300 hover:text-orange-400 text-lg leading-none py-1 transition">+</button>
                      </div>
                    </DroppableCell>
                  )
                })}
              </React.Fragment>
            ))}

            <div className="p-3 border-r border-gray-100"><span className="text-xs font-medium text-gray-400">Totals</span></div>
            {weekDates.map((date, i) => {
              const n = getDayNutrition(date)
              const calGoal = goals?.calories || 0
              const overGoal = calGoal > 0 && n.calories > calGoal
              return (
                <div key={i} className={`p-2 border-r border-gray-100 last:border-r-0 ${isToday(date) ? "bg-orange-50/30" : ""}`}>
                  {n.calories > 0 ? (
                    <div className="bg-gray-50 rounded-lg p-2 text-center">
                      <div className={`text-xs font-semibold ${calGoal > 0 ? (overGoal ? "text-red-500" : "text-green-600") : "text-gray-900"}`}>
                        {n.calories.toLocaleString()} cal
                      </div>
                      {calGoal > 0 && (
                        <div className={`text-[10px] mt-0.5 ${overGoal ? "text-red-400" : "text-gray-400"}`}>
                          {overGoal ? `${(n.calories - calGoal).toLocaleString()} over` : `${(calGoal - n.calories).toLocaleString()} left`} of {calGoal.toLocaleString()}
                        </div>
                      )}
                      <div className="text-xs text-gray-400 mt-0.5">
                        P:<span className={goals?.protein ? (n.protein >= goals.protein ? "text-green-600 font-medium" : "") : ""}>{n.protein}g</span>
                        {" "}C:{n.carbs}g F:{n.fat}g
                      </div>
                      {calGoal > 0 && (
                        <div className="w-full bg-gray-200 rounded-full h-1 mt-1.5 overflow-hidden">
                          <div className={`h-1 rounded-full ${overGoal ? "bg-red-400" : "bg-green-500"}`} style={{ width: `${Math.min(100, (n.calories / calGoal) * 100)}%` }} />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center text-xs text-gray-300">—</div>
                  )}
                </div>
              )
            })}
          </div>
          </DndContext>
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
                        <div className="text-orange-400"><PlateIcon size={20} /></div>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{r.title}</div>
                      <div className="flex gap-2 text-xs text-gray-400 mt-0.5 flex-wrap">
                        {r.category_name && (
                          <span className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">{r.category_name}</span>
                        )}
                        {r.prep_time && <span className="flex items-center gap-1"><ClockIcon size={11} />{r.prep_time}</span>}
                        {r.servings && <span className="flex items-center gap-1"><UserIcon size={11} />{r.servings}</span>}
                        {r.nutrition && (() => {
                          const n = typeof r.nutrition === "string" ? JSON.parse(r.nutrition) : r.nutrition
                          return <span className="flex items-center gap-1"><FlameIcon size={11} />{Math.round(n.calories)} cal</span>
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
              onClick={() => { setShowAddModal(false); setSelectedCookbook(""); setAllRecipes([]); setRecipeSearch(""); setSelectedCategoryFilter("") }}
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
                  <button onClick={() => deleteCategory(cat.id)} className="text-xs text-red-400 hover:text-red-600">Remove</button>
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
              <button onClick={addCategory} className="px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600">Add</button>
            </div>
            <button onClick={() => setShowCategoryModal(false)} className="w-full border border-gray-200 rounded-xl py-2 text-sm text-gray-500 hover:bg-gray-50">Done</button>
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
                  toast.success("Copied to clipboard!")
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
              <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Save to Grocery Lists</div>
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => { setSaveMode("new"); setGrocerySaved(false) }}
                  className={`flex-1 py-2 rounded-xl text-sm border transition ${saveMode === "new" ? "bg-orange-500 text-white border-orange-500" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                  New list
                </button>
                <button
                  onClick={() => { setSaveMode("existing"); setGrocerySaved(false) }}
                  disabled={existingLists.length === 0}
                  className={`flex-1 py-2 rounded-xl text-sm border transition ${saveMode === "existing" ? "bg-orange-500 text-white border-orange-500" : "border-gray-200 text-gray-500 hover:bg-gray-50"} disabled:opacity-40`}>
                  Add to existing
                </button>
              </div>

              {saveMode === "new" ? (
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
              ) : (
                <div className="flex gap-2">
                  <select
                    value={selectedExistingList}
                    onChange={e => { setSelectedExistingList(e.target.value); setGrocerySaved(false) }}
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none">
                    <option value="">Choose a list...</option>
                    {existingLists.map((list: any) => (
                      <option key={list.id} value={list.id}>{list.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={saveGroceryList}
                    disabled={savingGroceryList || grocerySaved || !selectedExistingList}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition ${grocerySaved ? "bg-green-500 text-white" : "bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50"}`}>
                    {savingGroceryList ? "Adding..." : grocerySaved ? "✓ Added!" : "Add"}
                  </button>
                </div>
              )}
            </div>

            <button onClick={() => { setShowGroceryModal(false); setGrocerySaved(false) }} className="w-full border border-gray-200 rounded-xl py-2 text-sm text-gray-500 hover:bg-gray-50 mt-4">Done</button>
          </div>
        </div>
      )}

      {showSyncModal && (
        <MealPlanSyncModal onClose={() => setShowSyncModal(false)} onSyncChange={fetchMeals} />
      )}

      {showGoalsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4">
            <h2 className="text-lg font-medium mb-1">Nutrition goals</h2>
            <p className="text-sm text-gray-400 mb-5">Daily targets — the planner totals turn green when you're on track and red when you're over.</p>
            <div className="grid grid-cols-2 gap-3 mb-5">
              {([
                { key: "calories", label: "Calories", placeholder: "e.g. 2200" },
                { key: "protein", label: "Protein (g)", placeholder: "e.g. 150" },
                { key: "carbs", label: "Carbs (g)", placeholder: "e.g. 250" },
                { key: "fat", label: "Fat (g)", placeholder: "e.g. 70" },
              ] as const).map(f => (
                <div key={f.key}>
                  <label className="text-xs text-gray-500 mb-1 block">{f.label}</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={goalInputs[f.key]}
                    onChange={e => setGoalInputs(prev => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-base md:text-sm outline-none"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowGoalsModal(false)} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm text-gray-500 hover:bg-gray-50">Cancel</button>
              {goals && (
                <button
                  onClick={() => { setGoalInputs({ calories: "", protein: "", carbs: "", fat: "" }); }}
                  className="flex-1 border border-red-100 text-red-400 rounded-xl py-2.5 text-sm hover:bg-red-50">
                  Clear
                </button>
              )}
              <button onClick={saveGoals} className="flex-1 bg-orange-500 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-orange-600">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}