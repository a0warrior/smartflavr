"use client"
import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useParams } from "next/navigation"
import Navbar from "@/app/components/Navbar"
import ImageCropper from "@/app/components/ImageCropper"
import CollaboratorModal from "@/app/components/CollaboratorModal"
import NutritionPanel from "@/app/components/NutritionPanel"
import { RecipePDFButton, CookbookPDFButton } from "@/app/components/PDFButtons"
import { db } from "@/lib/firebase"
import { ref, onValue, set, off } from "firebase/database"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

function SortableRecipeItem({ recipe, isSelected, onClick, isOwner, isFavorited, onToggleFavorite }: any) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: recipe.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div ref={setNodeRef} style={style} onClick={onClick} className={`mx-1 px-3 py-3.5 md:px-2 md:py-1.5 rounded-lg text-sm md:text-xs cursor-pointer flex items-center gap-2 md:gap-1 ${isSelected ? "bg-orange-50 text-orange-700 font-medium" : "text-gray-600 md:text-gray-500 hover:bg-gray-50"}`}>
      {isOwner && <span {...attributes} {...listeners} onClick={e => e.stopPropagation()} className="text-gray-300 cursor-grab text-xs mr-1 hidden md:block">⠿</span>}
      <span className="flex-1 truncate">{recipe.title}</span>
      <button
        onClick={e => { e.stopPropagation(); onToggleFavorite(recipe.id) }}
        className={`flex-shrink-0 text-sm md:text-xs transition ${isFavorited ? "text-red-400" : "text-gray-300 hover:text-red-300"}`}>
        {isFavorited ? "♥" : "♡"}
      </button>
      <svg className="w-3 h-3 text-gray-300 flex-shrink-0 md:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
    </div>
  )
}

export default function CookbookPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const [recipes, setRecipes] = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [selectedRecipe, setSelectedRecipe] = useState<any>(null)
  const [activeCategory, setActiveCategory] = useState("all")
  const [editMode, setEditMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState("")
  const [search, setSearch] = useState("")
  const [sortBy, setSortBy] = useState("default")
  const [edited, setEdited] = useState<any>(null)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [newCatName, setNewCatName] = useState("")
  const [newCatEmoji, setNewCatEmoji] = useState("📋")
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [recipeToDelete, setRecipeToDelete] = useState<string | null>(null)
  const [isPublic, setIsPublic] = useState(false)
  const [cookbookInfo, setCookbookInfo] = useState<any>(null)
  const [isOwner, setIsOwner] = useState(false)
  const [isCollaborator, setIsCollaborator] = useState(false)
  const [collaborators, setCollaborators] = useState<any[]>([])
  const [showCollaboratorModal, setShowCollaboratorModal] = useState(false)
  const [activeUsers, setActiveUsers] = useState<any[]>([])
  const [aiLoading, setAiLoading] = useState<string | null>(null)
  const [showUnsavedModal, setShowUnsavedModal] = useState(false)
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null)
  const [favorites, setFavorites] = useState<Set<number>>(new Set())
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const [recipeCropSrc, setRecipeCropSrc] = useState("")
  const [mobileView, setMobileView] = useState<"list" | "detail">("list")
  const [showMobileActions, setShowMobileActions] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login?code=returning")
    if (status === "authenticated") {
      fetchRecipes()
      fetchCategories()
      fetchCookbookInfo()
      fetchFavorites()
    }
  }, [status])

  useEffect(() => {
    if (!session?.user?.email || !params.id) return
    const presenceRef = ref(db, `cookbooks/${params.id}/presence/${session.user.email.replace(/\./g, "_")}`)
    const allPresenceRef = ref(db, `cookbooks/${params.id}/presence`)
    set(presenceRef, { name: session.user.name, email: session.user.email, timestamp: Date.now() })
    onValue(allPresenceRef, (snapshot) => {
      const data = snapshot.val()
      if (data) {
        const users = Object.values(data).filter((u: any) => Date.now() - u.timestamp < 30000 && u.email !== session.user?.email)
        setActiveUsers(users as any[])
      } else {
        setActiveUsers([])
      }
    })
    const interval = setInterval(() => {
      set(presenceRef, { name: session.user?.name, email: session.user?.email, timestamp: Date.now() })
    }, 10000)
    return () => { off(allPresenceRef); clearInterval(interval); set(presenceRef, null) }
  }, [session, params.id])

  useEffect(() => {
    if (!params.id) return
    const recipesRef = ref(db, `cookbooks/${params.id}/lastUpdate`)
    let initialized = false
    onValue(recipesRef, (snapshot) => {
      if (!initialized) { initialized = true; return }
      const data = snapshot.val()
      if (data && data.updatedBy !== session?.user?.email) fetchRecipes()
    })
    return () => off(recipesRef)
  }, [params.id, session])

  useEffect(() => {
    if (filteredRecipes.length > 0 && !selectedRecipe) {
      setSelectedRecipe(filteredRecipes[0])
    }
  }, [activeCategory])

  async function fetchRecipes() {
    const res = await fetch(`/api/recipes?cookbook_id=${params.id}`)
    const data = await res.json()
    const sorted = (data.recipes || []).sort((a: any, b: any) => a.sort_order - b.sort_order)
    setRecipes(sorted)
    const urlParams = new URLSearchParams(window.location.search)
    const recipeId = urlParams.get("recipe")
    if (recipeId) {
      const target = sorted.find((r: any) => r.id == recipeId)
      if (target) setSelectedRecipe(target)
    } else if (sorted.length > 0 && !selectedRecipe) {
      setSelectedRecipe(sorted[0])
    }
  }

  async function fetchCategories() {
    const res = await fetch(`/api/categories?cookbook_id=${params.id}`)
    const data = await res.json()
    setCategories(data.categories || [])
  }

  async function fetchCookbookInfo() {
    const [cookbookRes, profileRes, collaboratorsRes] = await Promise.all([
      fetch(`/api/cookbooks/${params.id}`),
      fetch("/api/profile"),
      fetch(`/api/collaborators?cookbook_id=${params.id}`)
    ])
    const cookbookData = await cookbookRes.json()
    const profileData = await profileRes.json()
    const collaboratorsData = await collaboratorsRes.json()
    if (cookbookData.cookbook) {
      setCookbookInfo(cookbookData.cookbook)
      setIsPublic(cookbookData.cookbook.is_public === 1)
      if (profileData.user) {
        const owner = cookbookData.cookbook.user_id === profileData.user.id
        setIsOwner(owner)
        if (!owner) {
          const isCollab = (collaboratorsData.collaborators || []).some(
            (c: any) => c.id === profileData.user.id && c.status === "accepted"
          )
          setIsCollaborator(isCollab)
        }
      }
    }
    setCollaborators(collaboratorsData.collaborators || [])
  }

  async function fetchFavorites() {
    const res = await fetch("/api/favorites")
    const data = await res.json()
    const ids = new Set<number>((data.favorites || []).map((f: any) => f.id))
    setFavorites(ids)
  }

  async function toggleFavorite(recipeId: number) {
    const isFav = favorites.has(recipeId)
    if (isFav) {
      await fetch("/api/favorites", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipe_id: recipeId }),
      })
      setFavorites(prev => { const next = new Set(prev); next.delete(recipeId); return next })
    } else {
      await fetch("/api/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipe_id: recipeId }),
      })
      setFavorites(prev => new Set([...prev, recipeId]))
    }
  }

  async function notifyFirebase() {
    await set(ref(db, `cookbooks/${params.id}/lastUpdate`), {
      updatedBy: session?.user?.email,
      timestamp: Date.now()
    })
  }

  async function saveRecipe() {
    if (!edited) return
    setSaving(true)
    await fetch(`/api/recipes/${edited.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(edited),
    })
    setSelectedRecipe(edited)
    setRecipes(prev => prev.map(r => r.id === edited.id ? edited : r))
    setSaving(false)
    setLastSaved("Saved just now")
    setEditMode(false)
    await notifyFirebase()
  }

  async function createRecipe() {
    const res = await fetch("/api/recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "New Recipe",
        cookbook_id: params.id,
        ingredients: "",
        instructions: "",
        description: "",
        prep_time: "",
        servings: "",
        notes: "",
        source_url: "",
        sort_order: recipes.length,
      }),
    })
    const data = await res.json()
    const recipesRes = await fetch(`/api/recipes?cookbook_id=${params.id}`)
    const recipesData = await recipesRes.json()
    const sorted = (recipesData.recipes || []).sort((a: any, b: any) => a.sort_order - b.sort_order)
    setRecipes(sorted)
    const newRecipe = sorted.find((r: any) => r.id === data.id) || sorted[sorted.length - 1]
    if (newRecipe) {
      setSelectedRecipe(newRecipe)
      setEdited({ ...newRecipe })
      setEditMode(true)
      setMobileView("detail")
    }
    await notifyFirebase()
  }

  async function deleteRecipe(id: string) {
    setShowDeleteModal(true)
    setRecipeToDelete(id)
  }

  async function confirmDelete() {
    if (!recipeToDelete) return
    await fetch(`/api/recipes/${recipeToDelete}`, { method: "DELETE" })
    setShowDeleteModal(false)
    setRecipeToDelete(null)
    setSelectedRecipe(null)
    setEditMode(false)
    await fetchRecipes()
    await notifyFirebase()
  }

  async function createCategory() {
    if (!newCatName) return
    await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cookbook_id: params.id, name: newCatName, emoji: newCatEmoji }),
    })
    setNewCatName("")
    setNewCatEmoji("📋")
    setShowCategoryModal(false)
    await fetchCategories()
  }

  function uploadPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => setRecipeCropSrc(reader.result as string)
    reader.readAsDataURL(file)
  }

  async function handleRecipeCrop(cropped: string) {
    setRecipeCropSrc("")
    const res = await fetch("/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: cropped }),
    })
    const data = await res.json()
    if (data.success) updateEdited("image_url", data.url)
  }

  async function handleDragEnd(event: any) {
    if (!isOwner && !isCollaborator) return
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = recipes.findIndex(r => r.id === active.id)
    const newIndex = recipes.findIndex(r => r.id === over.id)
    const newOrder = arrayMove(recipes, oldIndex, newIndex)
    setRecipes(newOrder)
    await Promise.all(newOrder.map((r, i) =>
      fetch(`/api/recipes/${r.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...r, sort_order: i }),
      })
    ))
    await notifyFirebase()
  }

  async function aiAssist(type: string) {
    if (!edited) return
    setAiLoading(type)
    const res = await fetch("/api/ai-assist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, recipe: edited }),
    })
    const data = await res.json()
    if (data.success) {
      switch (type) {
        case "description": updateEdited("description", data.content); break
        case "ingredients": updateEdited("ingredients", (edited.ingredients ? edited.ingredients + "\n" : "") + data.content); break
        case "instructions": updateEdited("instructions", data.content); break
        case "notes": updateEdited("notes", data.content); break
      }
    }
    setAiLoading(null)
  }

  function startEdit() {
    setEdited({ ...selectedRecipe })
    setEditMode(true)
    setLastSaved("")
  }

  function cancelEdit() {
    setEdited(null)
    setEditMode(false)
  }

  function updateEdited(field: string, value: string) {
    setEdited((prev: any) => ({ ...prev, [field]: value }))
  }

  function withUnsavedCheck(action: () => void) {
    if (editMode) {
      setPendingAction(() => action)
      setShowUnsavedModal(true)
      return
    }
    action()
  }

  function scrollToRecipe(id: string) {
    const target = recipes.find(r => r.id === id)
    withUnsavedCheck(() => {
      setSelectedRecipe(target)
      setMobileView("detail")
    })
  }

  async function handleUnsavedSave() {
    await saveRecipe()
    setShowUnsavedModal(false)
    const action = pendingAction
    setPendingAction(null)
    if (action) action()
  }

  function handleUnsavedDiscard() {
    cancelEdit()
    setShowUnsavedModal(false)
    const action = pendingAction
    setPendingAction(null)
    if (action) action()
  }

  useEffect(() => {
    if (!editMode) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [editMode])

  const filteredRecipes = recipes
    .filter(r => {
      const matchesSearch = r.title.toLowerCase().includes(search.toLowerCase())
      const matchesCategory = activeCategory === "all" || r.category_id == activeCategory
      const matchesFavorites = !showFavoritesOnly || favorites.has(r.id)
      return matchesSearch && matchesCategory && matchesFavorites
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "az": return a.title.localeCompare(b.title)
        case "za": return b.title.localeCompare(a.title)
        case "time_asc": return (parseInt(a.prep_time) || 999) - (parseInt(b.prep_time) || 999)
        case "time_desc": return (parseInt(b.prep_time) || 0) - (parseInt(a.prep_time) || 0)
        case "servings_asc": return (parseInt(a.servings) || 999) - (parseInt(b.servings) || 999)
        case "servings_desc": return (parseInt(b.servings) || 0) - (parseInt(a.servings) || 0)
        case "difficulty_asc": {
          const order = ["easy", "medium", "hard"]
          return order.indexOf(a.difficulty?.toLowerCase()) - order.indexOf(b.difficulty?.toLowerCase())
        }
        case "difficulty_desc": {
          const order = ["hard", "medium", "easy"]
          return order.indexOf(a.difficulty?.toLowerCase()) - order.indexOf(b.difficulty?.toLowerCase())
        }
        default: return a.sort_order - b.sort_order
      }
    })

  const canEdit = isOwner || isCollaborator
  const favCount = recipes.filter(r => favorites.has(r.id)).length

  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  const recipe = editMode ? edited : selectedRecipe

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="flex flex-1 overflow-hidden" style={{ height: "calc(100svh - 57px)" }}>

        <div className={`bg-white border-r border-gray-100 flex-col overflow-hidden flex-shrink-0 ${mobileView === "list" ? "flex w-full" : "hidden"} md:flex md:w-52`} style={{ height: "calc(100svh - 57px)" }}>
          <div className="p-3 border-b border-gray-100 flex-shrink-0">
            <button onClick={() => withUnsavedCheck(() => router.push("/dashboard"))} className="text-xs text-orange-500 mb-2 block">← Dashboard</button>
            <div className="text-sm font-medium truncate">{cookbookInfo?.title || "Cookbook"}</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-gray-400">{recipes.length} recipes</span>
              {activeUsers.length > 0 && (
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400"/>
                  <span className="text-xs text-gray-400">{activeUsers.length} viewing</span>
                </div>
              )}
            </div>
            {/* Cookbook-level actions — wrapping row on mobile, stacked on desktop */}
            <div className="mt-3 flex flex-wrap gap-1.5 md:flex-col md:flex-nowrap md:gap-1">
              {isPublic && isOwner && (
                <button
                  onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/share/cookbook/${params.id}`); alert("Link copied!") }}
                  className="whitespace-nowrap md:w-full flex items-center justify-center md:justify-start gap-2 px-3 py-2 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
                  🔗 Share
                </button>
              )}
              {isOwner && (
                <button
                  onClick={() => setShowCollaboratorModal(true)}
                  className="whitespace-nowrap md:w-full flex items-center justify-center md:justify-start gap-2 px-3 py-2 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
                  👥 Collabs
                </button>
              )}
              <CookbookPDFButton
                cookbook={cookbookInfo}
                recipes={recipes}
                authorName={session?.user?.name || ""}
                className="whitespace-nowrap md:w-full flex items-center justify-center md:justify-start gap-2 px-3 py-2 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
              />
              {isCollaborator && !isOwner && (
                <button
                  onClick={async () => {
                    if (!confirm("Leave this cookbook?")) return
                    await fetch("/api/collaborators", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cookbook_id: params.id, user_id: "self" }) })
                    router.push("/dashboard")
                  }}
                  className="whitespace-nowrap md:w-full flex items-center justify-center md:justify-start gap-2 px-3 py-2 text-xs text-red-400 border border-red-100 rounded-lg hover:bg-red-50 transition">
                  Leave cookbook
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="p-3 md:p-2 border-b border-gray-100 space-y-2">
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search recipes..." className="w-full bg-gray-50 border border-gray-100 rounded-lg px-3 py-2.5 md:px-2 md:py-1.5 text-sm md:text-xs"/>
              <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="w-full bg-gray-50 border border-gray-100 rounded-lg px-3 py-2.5 md:px-2 md:py-1.5 text-sm md:text-xs outline-none">
                <option value="default">Sort: Default</option>
                <option value="az">A → Z</option>
                <option value="za">Z → A</option>
                <option value="time_asc">Time: Shortest first</option>
                <option value="time_desc">Time: Longest first</option>
                <option value="servings_asc">Servings: Least first</option>
                <option value="servings_desc">Servings: Most first</option>
                <option value="difficulty_asc">Difficulty: Easiest first</option>
                <option value="difficulty_desc">Difficulty: Hardest first</option>
              </select>
            </div>
            <div className="px-3 md:px-2 pt-3 md:pt-2 pb-1 text-xs font-medium text-gray-400 uppercase tracking-wide flex items-center justify-between">
              Categories
              {isOwner && (
                <button onClick={() => setShowCategoryModal(true)} className="text-orange-400 font-normal normal-case text-xs">+ Add</button>
              )}
            </div>
            <div
              onClick={() => { setActiveCategory("all"); setShowFavoritesOnly(false); setSelectedRecipe(recipes[0] || null) }}
              className={`mx-1 px-3 py-3 md:px-2 md:py-1.5 rounded-lg text-sm md:text-xs cursor-pointer flex items-center gap-2 ${activeCategory === "all" && !showFavoritesOnly ? "bg-orange-50 text-orange-700 font-medium" : "text-gray-600 md:text-gray-500 hover:bg-gray-50"}`}>
              📋 All <span className="ml-auto text-gray-400">{recipes.length}</span>
            </div>
            <div
              onClick={() => { setActiveCategory("all"); setShowFavoritesOnly(!showFavoritesOnly); setSelectedRecipe(null) }}
              className={`mx-1 px-3 py-3 md:px-2 md:py-1.5 rounded-lg text-sm md:text-xs cursor-pointer flex items-center gap-2 ${showFavoritesOnly ? "bg-red-50 text-red-500 font-medium" : "text-gray-600 md:text-gray-500 hover:bg-gray-50"}`}>
              ♥ Favorites <span className="ml-auto text-gray-400">{favCount}</span>
            </div>
            {categories.map((cat: any) => {
              const count = recipes.filter(r => r.category_id == cat.id).length
              return (
                <div
                  key={cat.id}
                  onClick={() => { setActiveCategory(cat.id); setShowFavoritesOnly(false); setSelectedRecipe(null) }}
                  className={`mx-1 px-3 py-3 md:px-2 md:py-1.5 rounded-lg text-sm md:text-xs cursor-pointer flex items-center gap-2 ${activeCategory === cat.id && !showFavoritesOnly ? "bg-orange-50 text-orange-700 font-medium" : "text-gray-600 md:text-gray-500 hover:bg-gray-50"}`}>
                  {cat.emoji} {cat.name} <span className="ml-auto text-gray-400">{count}</span>
                </div>
              )
            })}
            <div className="border-t-2 border-gray-400 mx-3 mt-3" />
            <div className="px-3 md:px-2 pt-3 pb-1 text-xs font-medium text-gray-400 uppercase tracking-wide">Recipes</div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={filteredRecipes.map(r => r.id)} strategy={verticalListSortingStrategy}>
                {filteredRecipes.map((r: any) => (
                  <SortableRecipeItem
                    key={r.id}
                    recipe={r}
                    isSelected={selectedRecipe?.id === r.id}
                    onClick={() => scrollToRecipe(r.id)}
                    isOwner={canEdit}
                    isFavorited={favorites.has(r.id)}
                    onToggleFavorite={toggleFavorite}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>
          {canEdit && (
            <div className="p-3 md:p-2 border-t border-gray-100 flex-shrink-0">
              <button onClick={createRecipe} className="w-full bg-orange-500 text-white rounded-lg py-3 md:py-1.5 text-sm md:text-xs font-medium hover:bg-orange-600 transition">
                + Add Recipe
              </button>
            </div>
          )}
        </div>

        <div className={`flex-col overflow-hidden bg-gray-50 ${mobileView === "detail" ? "flex flex-1" : "hidden"} md:flex md:flex-1`}>
          {/* Mobile header — back + title + primary action + overflow */}
          <div className="md:hidden flex items-center gap-2 px-3 py-3 bg-white border-b border-gray-100 flex-shrink-0">
            <button onClick={() => withUnsavedCheck(() => setMobileView("list"))} className="p-1.5 -ml-1 rounded-lg text-orange-500 flex-shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
            </button>
            <span className="flex-1 font-medium text-gray-900 truncate text-sm">{recipe?.title || cookbookInfo?.title}</span>
            {editMode ? (
              <>
                <button onClick={cancelEdit} className="text-sm text-gray-400 px-2 py-1">Cancel</button>
                <button onClick={saveRecipe} disabled={saving} className="text-sm font-semibold text-white bg-orange-500 px-3 py-1.5 rounded-lg disabled:opacity-50">
                  {saving ? "Saving…" : "Save"}
                </button>
              </>
            ) : (
              <>
                {canEdit && recipe && (
                  <button onClick={startEdit} className="text-sm font-medium text-orange-500 px-2 py-1">Edit</button>
                )}
                <button onClick={() => setShowMobileActions(true)} className="p-1.5 rounded-lg text-gray-400">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
                </button>
              </>
            )}
          </div>

          {/* Desktop toolbar — recipe-level actions only */}
          <div className="hidden md:flex bg-white border-b border-gray-100 px-4 py-2 items-center gap-2 flex-shrink-0">
            {canEdit && !editMode && recipe && (
              <button onClick={startEdit} className="px-3 py-1 border border-orange-300 text-orange-500 rounded-lg text-xs hover:bg-orange-50">
                Edit
              </button>
            )}
            {canEdit && editMode && (
              <>
                <button onClick={cancelEdit} className="px-3 py-1 border border-gray-200 text-gray-500 rounded-lg text-xs hover:bg-gray-50">Cancel</button>
                <button onClick={saveRecipe} disabled={saving} className="px-3 py-1 bg-orange-500 text-white rounded-lg text-xs font-medium hover:bg-orange-600 disabled:opacity-50">
                  {saving ? "Saving..." : "Save"}
                </button>
              </>
            )}
            {isOwner && recipe && !editMode && (
              <button onClick={() => deleteRecipe(recipe.id)} className="px-3 py-1 border border-red-200 text-red-400 rounded-lg text-xs hover:bg-red-50">
                Delete
              </button>
            )}
            <div className="ml-auto flex items-center gap-2">
              {activeUsers.length > 0 && (
                <div className="flex items-center gap-1">
                  {activeUsers.slice(0, 3).map((u: any, i: number) => (
                    <div key={i} className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs border-2 border-white" title={u.name}>
                      {u.name?.charAt(0)}
                    </div>
                  ))}
                </div>
              )}
              {recipe && !editMode && <RecipePDFButton recipe={recipe} />}
              <span className="text-xs text-gray-400">{lastSaved}</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 md:px-8 md:py-6" id="recipe-content">
            {recipe ? (
              <>
                {!editMode ? (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <h1 className="text-2xl font-medium">{recipe.title}</h1>
                      <button onClick={() => toggleFavorite(recipe.id)} className={`text-2xl transition ${favorites.has(recipe.id) ? "text-red-400" : "text-gray-300 hover:text-red-300"}`}>
                        {favorites.has(recipe.id) ? "♥" : "♡"}
                      </button>
                    </div>
                    <div className="flex gap-2 mb-3 flex-wrap">
                      {recipe.prep_time && <span className="bg-gray-100 rounded-full px-3 py-1 text-xs text-gray-500">⏱ {recipe.prep_time}</span>}
                      {recipe.servings && <span className="bg-gray-100 rounded-full px-3 py-1 text-xs text-gray-500">👤 {recipe.servings}</span>}
                      {recipe.difficulty && <span className="bg-gray-100 rounded-full px-3 py-1 text-xs text-gray-500">★ {recipe.difficulty}</span>}
                    </div>
                    {recipe.description && <p className="text-sm text-gray-500 mb-5 leading-relaxed">{recipe.description}</p>}
                    <div className="rounded-xl mb-6 overflow-hidden">
                      {recipe.image_url ? <img src={recipe.image_url} className="w-full object-contain rounded-xl"/> : (
                        <div className="border-2 border-dashed border-gray-100 rounded-xl h-48 flex items-center justify-center">
                          <span className="text-xs text-gray-400">📷 No photo yet</span>
                        </div>
                      )}
                    </div>
                    {recipe.ingredients && (
                      <div id="ingredients" className="mb-6">
                        <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Ingredients</div>
                        {recipe.ingredients.split("\n").filter(Boolean).map((ing: string, i: number) => (
                          <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-50">
                            <input type="checkbox" className="w-3.5 h-3.5 accent-orange-500 flex-shrink-0"/>
                            <span className="text-sm">{ing}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {recipe.instructions && (
                      <div id="instructions" className="mb-6">
                        <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Instructions</div>
                        {recipe.instructions.split("\n").filter(Boolean).map((step: string, i: number) => (
                          <div key={i} className="flex gap-3 mb-4">
                            <div className="w-6 h-6 rounded-full bg-orange-50 text-orange-700 text-xs font-medium flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</div>
                            <p className="text-sm leading-relaxed flex-1">{step}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {recipe.notes && (
                      <div id="notes" className="mb-6">
                        <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Notes</div>
                        <div className="bg-amber-50 rounded-xl p-4 text-sm text-amber-800 leading-relaxed">💡 {recipe.notes}</div>
                      </div>
                    )}
                    <NutritionPanel recipe={recipe}/>
                    <div className="flex items-center gap-3 mt-4 flex-wrap">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/share/recipe/${recipe.id}`)
                          alert("Recipe link copied to clipboard!")
                        }}
                        className="px-3 py-1.5 border border-orange-200 text-orange-500 rounded-lg text-xs hover:bg-orange-50 transition">
                        Share recipe ↗
                      </button>
                      <RecipePDFButton recipe={recipe} />
                      {recipe.source_url && (
                        <a href={recipe.source_url} target="_blank" className="text-xs text-orange-500">View original source ↗</a>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <input value={edited.title || ""} onChange={e => updateEdited("title", e.target.value)} className="text-2xl font-medium bg-transparent border-b border-gray-200 outline-none w-full mb-4 pb-2" placeholder="Recipe title"/>
                    <div className="flex gap-2 mb-4 flex-wrap">
                      <input value={edited.prep_time || ""} onChange={e => updateEdited("prep_time", e.target.value)} placeholder="⏱ Time" className="bg-white border border-gray-200 rounded-full px-3 py-1 text-xs w-28 outline-none"/>
                      <input value={edited.servings || ""} onChange={e => updateEdited("servings", e.target.value)} placeholder="👤 Servings" className="bg-white border border-gray-200 rounded-full px-3 py-1 text-xs w-28 outline-none"/>
                      <input value={edited.difficulty || ""} onChange={e => updateEdited("difficulty", e.target.value)} placeholder="★ Difficulty" className="bg-white border border-gray-200 rounded-full px-3 py-1 text-xs w-28 outline-none"/>
                      <select value={edited.category_id || ""} onChange={e => updateEdited("category_id", e.target.value)} className="bg-white border border-gray-200 rounded-full px-3 py-1 text-xs outline-none">
                        <option value="">📋 No category</option>
                        {categories.map((cat: any) => (
                          <option key={cat.id} value={cat.id}>{cat.emoji} {cat.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="relative mb-4">
                      <div
                        onClick={() => !edited?.image_url && document.getElementById("photo-upload")?.click()}
                        className="border-2 border-dashed border-gray-100 rounded-xl overflow-hidden cursor-pointer hover:bg-gray-50"
                        style={{ minHeight: "200px" }}>
                        {edited?.image_url ? (
                          <img src={edited.image_url} className="w-full object-contain rounded-xl"/>
                        ) : (
                          <div className="h-48 flex items-center justify-center">
                            <span className="text-xs text-gray-400">📷 Click to add photo</span>
                          </div>
                        )}
                      </div>
                      {edited?.image_url && (
                        <div className="absolute top-2 right-2 flex gap-2">
                          <button onClick={() => document.getElementById("photo-upload")?.click()} className="bg-white border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-500 hover:bg-gray-50">Change</button>
                          <button onClick={() => updateEdited("image_url", "")} className="bg-white border border-red-200 rounded-lg px-2 py-1 text-xs text-red-400 hover:bg-red-50">Delete</button>
                        </div>
                      )}
                    </div>
                    <input type="file" id="photo-upload" accept="image/*" onChange={uploadPhoto} className="hidden"/>
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">Description</div>
                        <button onClick={() => aiAssist("description")} disabled={aiLoading === "description"} className="text-xs text-orange-500 hover:text-orange-600 flex items-center gap-1">
                          {aiLoading === "description" ? "✨ Writing..." : "✨ AI write"}
                        </button>
                      </div>
                      <textarea value={edited.description || ""} onChange={e => updateEdited("description", e.target.value)} placeholder="Add a description..." className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none outline-none" rows={2}/>
                    </div>
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">Ingredients <span className="text-gray-300 font-normal normal-case">(one per line)</span></div>
                        <button onClick={() => aiAssist("ingredients")} disabled={aiLoading === "ingredients"} className="text-xs text-orange-500 hover:text-orange-600 flex items-center gap-1">
                          {aiLoading === "ingredients" ? "✨ Suggesting..." : "✨ AI suggest"}
                        </button>
                      </div>
                      <textarea value={edited.ingredients || ""} onChange={e => updateEdited("ingredients", e.target.value)} placeholder="200g pasta&#10;100g cheese&#10;Salt" className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none outline-none" rows={6}/>
                    </div>
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">Instructions <span className="text-gray-300 font-normal normal-case">(one step per line)</span></div>
                        <button onClick={() => aiAssist("instructions")} disabled={aiLoading === "instructions"} className="text-xs text-orange-500 hover:text-orange-600 flex items-center gap-1">
                          {aiLoading === "instructions" ? "✨ Improving..." : "✨ AI improve"}
                        </button>
                      </div>
                      <textarea value={edited.instructions || ""} onChange={e => updateEdited("instructions", e.target.value)} placeholder="Boil water&#10;Add pasta&#10;Drain and serve" className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none outline-none" rows={8}/>
                    </div>
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">Notes</div>
                        <button onClick={() => aiAssist("notes")} disabled={aiLoading === "notes"} className="text-xs text-orange-500 hover:text-orange-600 flex items-center gap-1">
                          {aiLoading === "notes" ? "✨ Generating..." : "✨ AI generate"}
                        </button>
                      </div>
                      <textarea value={edited.notes || ""} onChange={e => updateEdited("notes", e.target.value)} placeholder="Tips, variations, substitutions..." className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none outline-none" rows={3}/>
                    </div>
                    <div className="mb-4">
                      <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Source URL</div>
                      <input value={edited.source_url || ""} onChange={e => updateEdited("source_url", e.target.value)} placeholder="https://..." className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none"/>
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                <div className="text-center">
                  <p className="text-4xl mb-3">🍽️</p>
                  <p className="text-sm">No recipes in this category yet</p>
                </div>
              </div>
            )}
          </div>

          {recipe && !editMode && (
            <div className="bg-white border-t border-gray-100 px-4 py-2 flex gap-2 overflow-x-auto flex-shrink-0">
              {["Top", "Ingredients", "Instructions", "Notes"].map(section => (
                <button key={section} onClick={() => {
                  if (section === "Top") document.getElementById("recipe-content")?.scrollTo({ top: 0, behavior: "smooth" })
                  else document.getElementById(section.toLowerCase())?.scrollIntoView({ behavior: "smooth" })
                }} className="px-3 py-2 md:py-1 rounded-full text-sm md:text-xs border border-gray-200 text-gray-500 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 transition whitespace-nowrap flex-shrink-0">
                  {section}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {showUnsavedModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4">
            <h2 className="text-lg font-medium mb-2">Save changes?</h2>
            <p className="text-sm text-gray-500 mb-6">You have unsaved changes to <span className="font-medium text-gray-700">{edited?.title}</span>.</p>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowUnsavedModal(false); setPendingAction(null) }}
                className="px-3 py-2 text-sm text-gray-400 hover:text-gray-600 transition">
                Keep editing
              </button>
              <button onClick={handleUnsavedDiscard} className="flex-1 border border-gray-200 rounded-xl py-2 text-sm text-gray-500 hover:bg-gray-50">Discard</button>
              <button onClick={handleUnsavedSave} disabled={saving} className="flex-1 bg-orange-500 text-white rounded-xl py-2 text-sm font-medium hover:bg-orange-600">
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4">
            <h2 className="text-lg font-medium mb-2">Delete Recipe?</h2>
            <p className="text-sm text-gray-500 mb-6">This can't be undone. Are you sure?</p>
            <div className="flex gap-3">
              <button onClick={() => { setShowDeleteModal(false); setRecipeToDelete(null) }} className="flex-1 border border-gray-200 rounded-xl py-2 text-sm text-gray-500 hover:bg-gray-50">Cancel</button>
              <button onClick={confirmDelete} className="flex-1 bg-red-500 text-white rounded-xl py-2 text-sm font-medium hover:bg-red-600">Delete</button>
            </div>
          </div>
        </div>
      )}

      {showCategoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4">
            <h2 className="text-lg font-medium mb-4">New Category</h2>
            <div className="mb-4">
              <label className="text-sm text-gray-500 mb-1 block">Emoji</label>
              <input value={newCatEmoji} onChange={e => setNewCatEmoji(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 w-16 text-center text-2xl"/>
            </div>
            <div className="mb-6">
              <label className="text-sm text-gray-500 mb-1 block">Name</label>
              <input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="e.g. Pasta" className="border border-gray-200 rounded-lg px-3 py-2 w-full text-sm"/>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowCategoryModal(false)} className="flex-1 border border-gray-200 rounded-xl py-2 text-sm text-gray-500 hover:bg-gray-50">Cancel</button>
              <button onClick={createCategory} className="flex-1 bg-orange-500 text-white rounded-xl py-2 text-sm font-medium hover:bg-orange-600">Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile actions bottom sheet */}
      {showMobileActions && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowMobileActions(false)} />
          <div className="relative bg-white rounded-t-2xl pt-2 pb-8 z-10">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
            {recipe && (
              <div className="px-4 pb-3 border-b border-gray-100 mb-1">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Recipe</p>
                <p className="text-sm font-medium text-gray-900 truncate">{recipe.title}</p>
              </div>
            )}
            <div className="px-2">
              {recipe && <RecipePDFButton recipe={recipe} className="w-full text-left px-4 py-3.5 text-sm text-gray-700 hover:bg-gray-50 rounded-xl flex items-center gap-3" />}
              {isOwner && recipe && (
                <button
                  onClick={() => { deleteRecipe(recipe.id); setShowMobileActions(false) }}
                  className="w-full text-left px-4 py-3.5 text-sm text-red-500 hover:bg-red-50 rounded-xl flex items-center gap-3">
                  <span className="text-base">🗑️</span> Delete recipe
                </button>
              )}
            </div>
            <button onClick={() => setShowMobileActions(false)} className="w-full mt-2 py-3 text-sm text-gray-400 border-t border-gray-100">
              Cancel
            </button>
          </div>
        </div>
      )}

      {showCollaboratorModal && (
        <CollaboratorModal
          cookbookId={params.id as string}
          collaborators={collaborators}
          onClose={() => {
            setShowCollaboratorModal(false)
            fetchCookbookInfo()
          }}
        />
      )}

      {recipeCropSrc && (
        <ImageCropper
          image={recipeCropSrc}
          aspect={4 / 3}
          onCrop={handleRecipeCrop}
          onCancel={() => setRecipeCropSrc("")}
        />
      )}
    </div>
  )
}