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

import { HeartIcon, ShareIcon, PeopleIcon, PrintIcon, SearchIcon, ClockIcon, ChevronRightIcon, SortIcon, ListIcon, LeaveIcon, SparkleIcon, UserIcon, StarIcon, LightBulbIcon, CameraIcon, PlateIcon, TrashIcon } from "@/app/components/Icons"

function SortableRecipeItem({ recipe, isSelected, onClick, isOwner, isFavorited, onToggleFavorite }: any) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: recipe.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div ref={setNodeRef} style={style} onClick={onClick}
      className={`mx-2 mb-0.5 px-3 py-2.5 rounded-xl cursor-pointer flex items-center gap-3 group transition-colors md:rounded-xl ${
        isSelected ? "bg-orange-50 border border-orange-100" : "hover:bg-gray-50 border border-transparent"
      } md:mx-2 mx-1 md:py-2.5 py-3.5 md:gap-3 gap-2`}>
      {isOwner && (
        <span {...attributes} {...listeners} onClick={e => e.stopPropagation()}
          className="text-gray-300 cursor-grab hidden md:flex items-center flex-shrink-0 -ml-1 hover:text-gray-400">
          <SortIcon size={12} />
        </span>
      )}
      {/* Mobile-only chevron on left */}
      <svg className="w-3 h-3 text-gray-300 flex-shrink-0 md:hidden rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
      {recipe.image_url && (
        <img src={recipe.image_url} alt="" className="hidden md:block w-9 h-9 rounded-lg object-cover flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate leading-tight ${isSelected ? "text-orange-700" : "text-gray-800"}`}>{recipe.title}</p>
        {recipe.prep_time && (
          <p className="text-xs text-gray-400 mt-0.5 hidden md:flex items-center gap-1">
            <ClockIcon size={10} />{recipe.prep_time}
          </p>
        )}
      </div>
      <button
        onClick={e => { e.stopPropagation(); onToggleFavorite(recipe.id) }}
        className={`flex-shrink-0 transition ${isFavorited ? "text-red-400" : "text-gray-200 md:opacity-0 md:group-hover:opacity-100 hover:text-red-300"}`}>
        <HeartIcon filled={isFavorited} size={14} />
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
  const [showMobileSort, setShowMobileSort] = useState(false)

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
    <div className="flex flex-col overflow-hidden" style={{ height: "100svh" }}>
      <Navbar />
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* ── MOBILE COOKBOOK LIST (full-screen, replaces sidebar on mobile) ── */}
        {mobileView === "list" && (
          <div className="md:hidden flex flex-col w-full min-h-0 flex-1">

            {/* Pinned header */}
            <div className="flex-shrink-0 bg-white">
              {/* Hero with cover */}
              <div className="relative h-44">
                {cookbookInfo?.cover_image ? (
                  <img src={cookbookInfo.cover_image} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full" style={{ background: cookbookInfo?.cover_color || "#F97316" }} />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-black/10" />
                {!cookbookInfo?.cover_image && cookbookInfo?.cover_emoji && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
                    <span className="text-7xl opacity-20">{cookbookInfo.cover_emoji}</span>
                  </div>
                )}
                <button
                  onClick={() => withUnsavedCheck(() => router.push("/dashboard"))}
                  className="absolute top-4 left-4 flex items-center gap-1.5 bg-white/90 backdrop-blur-sm rounded-xl px-3 py-2 text-xs font-medium text-gray-700 shadow-sm">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                  Dashboard
                </button>
                <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
                  <h1 className="text-xl font-bold text-white leading-tight line-clamp-2">{cookbookInfo?.title || "Cookbook"}</h1>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-sm text-white/75">{recipes.length} recipe{recipes.length !== 1 ? "s" : ""}</span>
                    {activeUsers.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                        <span className="text-xs text-white/60">{activeUsers.length} viewing</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 px-4 pt-3 pb-2">
                {isPublic && isOwner && (
                  <button
                    onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/share/cookbook/${params.id}`); alert("Link copied!") }}
                    className="flex-1 flex flex-col items-center gap-1 py-3 bg-gray-50 rounded-2xl text-xs text-gray-600 active:bg-gray-100 transition">
                    <ShareIcon size={18} />
                    <span>Share</span>
                  </button>
                )}
                {isOwner && (
                  <button
                    onClick={() => setShowCollaboratorModal(true)}
                    className="flex-1 flex flex-col items-center gap-1 py-3 bg-gray-50 rounded-2xl text-xs text-gray-600 active:bg-gray-100 transition">
                    <PeopleIcon size={18} />
                    <span>Collabs</span>
                  </button>
                )}
                <CookbookPDFButton
                  cookbook={cookbookInfo}
                  recipes={recipes}
                  authorName={session?.user?.name || ""}
                  className="flex-1 flex flex-col items-center gap-1 py-3 bg-gray-50 rounded-2xl text-xs text-gray-600 active:bg-gray-100 transition">
                  <PrintIcon size={18} />
                  <span>Print</span>
                </CookbookPDFButton>
                {isCollaborator && !isOwner && (
                  <button
                    onClick={async () => {
                      if (!confirm("Leave this cookbook?")) return
                      await fetch("/api/collaborators", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cookbook_id: params.id, user_id: "self" }) })
                      router.push("/dashboard")
                    }}
                    className="flex-1 flex flex-col items-center gap-1 py-3 bg-gray-50 rounded-2xl text-xs text-red-400 active:bg-red-50 transition">
                    <LeaveIcon size={18} />
                    <span>Leave</span>
                  </button>
                )}
              </div>

              {/* Search + Sort */}
              <div className="flex gap-2 px-4 pb-2">
                <div className="flex-1 relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                    <SearchIcon size={15} />
                  </div>
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search recipes…"
                    className="w-full bg-gray-50 border border-gray-100 rounded-xl pl-9 pr-3 py-2.5 text-sm outline-none"
                  />
                </div>
                <button
                  onClick={() => setShowMobileSort(true)}
                  className={`flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-xl border transition ${sortBy !== "default" ? "bg-orange-50 border-orange-200 text-orange-500" : "bg-gray-50 border-gray-100 text-gray-500"}`}>
                  <SortIcon size={18} />
                </button>
              </div>

              {/* Category chips — horizontal scroll */}
              <div className="flex gap-2 px-4 pb-3 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                <button
                  onClick={() => { setActiveCategory("all"); setShowFavoritesOnly(false) }}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition ${activeCategory === "all" && !showFavoritesOnly ? "bg-orange-500 text-white" : "bg-gray-50 border border-gray-100 text-gray-600"}`}>
                  <ListIcon size={13} />
                  All
                  <span className={`text-xs ${activeCategory === "all" && !showFavoritesOnly ? "text-orange-100" : "text-gray-400"}`}>{recipes.length}</span>
                </button>
                <button
                  onClick={() => { setActiveCategory("all"); setShowFavoritesOnly(!showFavoritesOnly) }}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition ${showFavoritesOnly ? "bg-red-400 text-white" : "bg-gray-50 border border-gray-100 text-gray-600"}`}>
                  <HeartIcon filled={showFavoritesOnly} size={13} />
                  Saved
                  <span className={`text-xs ${showFavoritesOnly ? "text-red-100" : "text-gray-400"}`}>{favCount}</span>
                </button>
                {categories.map((cat: any) => {
                  const count = recipes.filter((r: any) => r.category_id == cat.id).length
                  const isActive = activeCategory === cat.id && !showFavoritesOnly
                  return (
                    <button
                      key={cat.id}
                      onClick={() => { setActiveCategory(cat.id); setShowFavoritesOnly(false) }}
                      className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition ${isActive ? "bg-orange-500 text-white" : "bg-gray-50 border border-gray-100 text-gray-600"}`}>
                      {cat.emoji} {cat.name}
                      <span className={`text-xs ${isActive ? "text-orange-100" : "text-gray-400"}`}>{count}</span>
                    </button>
                  )
                })}
                {isOwner && (
                  <button
                    onClick={() => setShowCategoryModal(true)}
                    className="flex-shrink-0 px-3 py-1.5 rounded-full text-sm text-orange-400 border border-dashed border-orange-200 whitespace-nowrap">
                    + Category
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable recipe cards — or static empty state */}
            {filteredRecipes.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center bg-gray-50 px-8">
                <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center mb-4 text-gray-300">
                  <ListIcon size={28} />
                </div>
                <p className="text-gray-500 font-medium text-sm">{search ? "No matching recipes" : "No recipes yet"}</p>
                {canEdit && !search && (
                  <button onClick={createRecipe} className="mt-4 px-5 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-semibold shadow-sm">
                    Add your first recipe
                  </button>
                )}
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto min-h-0 bg-gray-50 px-4 pt-2 pb-4">
                <div className="space-y-2">
                  {filteredRecipes.map((r: any) => (
                    <button
                      key={r.id}
                      onClick={() => scrollToRecipe(r.id)}
                      className={`w-full text-left flex items-center gap-3 p-3.5 rounded-2xl bg-white shadow-sm border transition active:bg-gray-50 ${selectedRecipe?.id === r.id ? "border-orange-200" : "border-transparent"}`}>
                      {r.image_url && (
                        <img src={r.image_url} alt="" className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-[15px] leading-snug truncate">{r.title}</p>
                        {r.prep_time && (
                          <p className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                            <ClockIcon size={11} />
                            {r.prep_time}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2.5 flex-shrink-0">
                        <button
                          onClick={e => { e.stopPropagation(); toggleFavorite(r.id) }}
                          className={`transition ${favorites.has(r.id) ? "text-red-400" : "text-gray-200 active:text-red-300"}`}>
                          <HeartIcon filled={favorites.has(r.id)} size={18} />
                        </button>
                        <div className="text-gray-300">
                          <ChevronRightIcon size={16} />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Pinned add recipe footer */}
            {canEdit && (
              <div className="flex-shrink-0 bg-white border-t border-gray-100 px-4 pt-3" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom, 12px))" }}>
                <button
                  onClick={createRecipe}
                  className="w-full bg-orange-500 text-white rounded-2xl py-3.5 text-[15px] font-semibold active:bg-orange-600 transition flex items-center justify-center gap-2">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  Add Recipe
                </button>
              </div>
            )}

            {/* Sort bottom sheet */}
            {showMobileSort && (
              <div className="fixed inset-0 z-50 flex flex-col justify-end">
                <div className="absolute inset-0 bg-black/40" onClick={() => setShowMobileSort(false)} />
                <div className="relative bg-white rounded-t-3xl px-4 pt-5 pb-10 z-10">
                  <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-5" />
                  <h3 className="text-base font-semibold text-gray-900 mb-3">Sort recipes</h3>
                  <div className="space-y-0.5">
                    {([
                      ["default", "Default order"],
                      ["az", "A → Z"],
                      ["za", "Z → A"],
                      ["time_asc", "Shortest prep time"],
                      ["time_desc", "Longest prep time"],
                      ["servings_asc", "Fewest servings"],
                      ["servings_desc", "Most servings"],
                      ["difficulty_asc", "Easiest first"],
                      ["difficulty_desc", "Hardest first"],
                    ] as [string, string][]).map(([value, label]) => (
                      <button
                        key={value}
                        onClick={() => { setSortBy(value); setShowMobileSort(false) }}
                        className={`w-full text-left px-4 py-3 rounded-xl text-sm transition flex items-center justify-between ${sortBy === value ? "bg-orange-50 text-orange-600 font-medium" : "text-gray-700 active:bg-gray-50"}`}>
                        {label}
                        {sortBy === value && (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── DESKTOP SIDEBAR ── */}
        <div className="hidden md:flex flex-col bg-white border-r border-gray-100 overflow-hidden flex-shrink-0 w-72">

          {/* Cookbook hero */}
          <div className="relative h-36 flex-shrink-0 overflow-hidden">
            {cookbookInfo?.cover_image ? (
              <img src={cookbookInfo.cover_image} className="w-full h-full object-cover" alt="" />
            ) : (
              <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: (cookbookInfo?.cover_color || "#F97316") + "22" }}>
                <span className="text-6xl">{cookbookInfo?.cover_emoji || "📖"}</span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
            <button
              onClick={() => withUnsavedCheck(() => router.push("/dashboard"))}
              className="absolute top-3 left-3 flex items-center gap-1 bg-black/30 hover:bg-black/50 text-white text-xs px-2.5 py-1 rounded-lg backdrop-blur-sm transition">
              ← Dashboard
            </button>
            <div className="absolute bottom-0 left-0 right-0 px-4 pb-3">
              <h2 className="text-white font-semibold text-[15px] leading-tight truncate drop-shadow">{cookbookInfo?.title || "Cookbook"}</h2>
              <p className="text-white/70 text-xs mt-0.5 flex items-center gap-2">
                {recipes.length} recipe{recipes.length !== 1 ? "s" : ""}
                {activeUsers.length > 0 && (
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                    {activeUsers.length} viewing
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Action buttons row */}
          <div className="flex border-b border-gray-100 flex-shrink-0">
            {isPublic && isOwner && (
              <button
                title="Copy share link"
                onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/share/cookbook/${params.id}`); alert("Link copied!") }}
                className="flex-1 flex flex-col items-center gap-1 py-3 text-xs text-gray-500 hover:bg-gray-50 hover:text-orange-500 transition">
                <ShareIcon size={17} />Share
              </button>
            )}
            {isOwner && (
              <button
                title="Manage collaborators"
                onClick={() => setShowCollaboratorModal(true)}
                className="flex-1 flex flex-col items-center gap-1 py-3 text-xs text-gray-500 hover:bg-gray-50 hover:text-orange-500 transition">
                <PeopleIcon size={17} />Collabs
              </button>
            )}
            <CookbookPDFButton
              cookbook={cookbookInfo}
              recipes={recipes}
              authorName={session?.user?.name || ""}
              className="flex-1 flex flex-col items-center gap-1 py-3 text-xs text-gray-500 hover:bg-gray-50 hover:text-orange-500 transition">
              <PrintIcon size={17} />Print
            </CookbookPDFButton>
            {isCollaborator && !isOwner && (
              <button
                onClick={async () => {
                  if (!confirm("Leave this cookbook?")) return
                  await fetch("/api/collaborators", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cookbook_id: params.id, user_id: "self" }) })
                  router.push("/dashboard")
                }}
                className="flex-1 flex flex-col items-center gap-1 py-3 text-xs text-red-400 hover:bg-red-50 transition">
                <LeaveIcon size={17} />Leave
              </button>
            )}
          </div>

          {/* Search */}
          <div className="px-3 pt-3 pb-2 flex-shrink-0">
            <div className="relative">
              <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"><SearchIcon size={13} /></div>
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search recipes..."
                className="w-full bg-gray-50 border border-gray-100 rounded-xl pl-7 pr-3 py-2 text-sm outline-none focus:border-orange-200 focus:bg-white transition placeholder:text-gray-400"
              />
            </div>
          </div>

          {/* Sort */}
          <div className="px-3 pb-3 flex-shrink-0">
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="w-full bg-gray-50 border border-gray-100 rounded-xl px-3 py-2 text-sm outline-none text-gray-600 cursor-pointer">
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

          {/* Scrollable nav: categories + recipes */}
          <div className="flex-1 overflow-y-auto min-h-0 border-t border-gray-100">

            {/* Categories */}
            <div className="px-3 pt-3 pb-2">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Categories</p>
              <div className="space-y-0.5">
                <button
                  onClick={() => { setActiveCategory("all"); setShowFavoritesOnly(false); setSelectedRecipe(recipes[0] || null) }}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm transition ${activeCategory === "all" && !showFavoritesOnly ? "bg-orange-50 text-orange-700 font-medium" : "text-gray-600 hover:bg-gray-50"}`}>
                  <ListIcon size={14} />
                  <span className="flex-1 text-left">All</span>
                  <span className="text-xs text-gray-400 tabular-nums">{recipes.length}</span>
                </button>
                <button
                  onClick={() => { setActiveCategory("all"); setShowFavoritesOnly(!showFavoritesOnly); setSelectedRecipe(null) }}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm transition ${showFavoritesOnly ? "bg-red-50 text-red-500 font-medium" : "text-gray-600 hover:bg-gray-50"}`}>
                  <HeartIcon filled={showFavoritesOnly} size={14} />
                  <span className="flex-1 text-left">Saved</span>
                  <span className="text-xs text-gray-400 tabular-nums">{favCount}</span>
                </button>
                {categories.map((cat: any) => {
                  const count = recipes.filter(r => r.category_id == cat.id).length
                  const isActive = activeCategory === cat.id && !showFavoritesOnly
                  return (
                    <button
                      key={cat.id}
                      onClick={() => { setActiveCategory(cat.id); setShowFavoritesOnly(false); setSelectedRecipe(null) }}
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm transition ${isActive ? "bg-orange-50 text-orange-700 font-medium" : "text-gray-600 hover:bg-gray-50"}`}>
                      <span className="text-base leading-none flex-shrink-0">{cat.emoji}</span>
                      <span className="flex-1 text-left truncate">{cat.name}</span>
                      <span className="text-xs text-gray-400 tabular-nums">{count}</span>
                    </button>
                  )
                })}
                {isOwner && (
                  <button
                    onClick={() => setShowCategoryModal(true)}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm text-orange-400 border border-dashed border-orange-200 hover:bg-orange-50 hover:border-orange-300 hover:text-orange-500 transition mt-1">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    New category
                  </button>
                )}
              </div>
            </div>

            {/* Recipes section */}
            <div className="px-3 pt-2 pb-1 border-t border-gray-100">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider py-2">
                Recipes {filteredRecipes.length !== recipes.length && <span className="normal-case font-normal text-gray-400">({filteredRecipes.length} shown)</span>}
              </p>
            </div>
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
            <div className="h-2" />
          </div>

          {/* Add Recipe */}
          {canEdit && (
            <div className="flex-shrink-0 px-3 py-3 border-t border-gray-100">
              <button
                onClick={createRecipe}
                className="w-full bg-orange-500 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-orange-600 transition flex items-center justify-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Add Recipe
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

          {/* Desktop toolbar */}
          <div className="hidden md:flex bg-white border-b border-gray-100 px-6 py-3 items-center gap-4 flex-shrink-0">
            <div className="flex-1 min-w-0">
              {recipe && !editMode && (
                <p className="text-sm font-semibold text-gray-900 truncate">{recipe.title}</p>
              )}
              {editMode && <p className="text-sm text-gray-400 font-medium">Editing recipe</p>}
              {lastSaved && <p className="text-xs text-gray-400 mt-0.5">{lastSaved}</p>}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {activeUsers.length > 0 && (
                <div className="flex items-center mr-1">
                  {activeUsers.slice(0, 3).map((u: any, i: number) => (
                    <div key={i} className="w-7 h-7 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs border-2 border-white -ml-1 first:ml-0 shadow-sm" title={u.name}>
                      {u.name?.charAt(0)}
                    </div>
                  ))}
                </div>
              )}
              {recipe && !editMode && <RecipePDFButton recipe={recipe} />}
              {isOwner && recipe && !editMode && (
                <button onClick={() => deleteRecipe(recipe.id)} className="px-3 py-1.5 border border-red-100 text-red-400 rounded-lg text-sm hover:bg-red-50 transition">
                  Delete
                </button>
              )}
              {canEdit && !editMode && recipe && (
                <button onClick={startEdit} className="px-4 py-1.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition">
                  Edit
                </button>
              )}
              {canEdit && editMode && (
                <>
                  <button onClick={cancelEdit} className="px-4 py-1.5 border border-gray-200 text-gray-500 rounded-lg text-sm hover:bg-gray-50 transition">Cancel</button>
                  <button onClick={saveRecipe} disabled={saving} className="px-4 py-1.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50 transition">
                    {saving ? "Saving..." : "Save"}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 md:px-8 md:py-6" id="recipe-content">
            {recipe ? (
              <>
                {!editMode ? (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <h1 className="text-2xl font-medium">{recipe.title}</h1>
                      <button onClick={() => toggleFavorite(recipe.id)} className={`transition ${favorites.has(recipe.id) ? "text-red-400" : "text-gray-300 hover:text-red-300"}`}>
                        <HeartIcon filled={favorites.has(recipe.id)} size={24} />
                      </button>
                    </div>
                    <div className="flex gap-2 mb-3 flex-wrap">
                      {recipe.prep_time && <span className="bg-gray-100 rounded-full px-3 py-1 text-xs text-gray-500 flex items-center gap-1.5"><ClockIcon size={11} />{recipe.prep_time}</span>}
                      {recipe.servings && <span className="bg-gray-100 rounded-full px-3 py-1 text-xs text-gray-500 flex items-center gap-1.5"><UserIcon size={11} />{recipe.servings}</span>}
                      {recipe.difficulty && <span className="bg-gray-100 rounded-full px-3 py-1 text-xs text-gray-500 flex items-center gap-1.5"><StarIcon size={11} />{recipe.difficulty}</span>}
                    </div>
                    {recipe.description && <p className="text-sm text-gray-500 mb-5 leading-relaxed">{recipe.description}</p>}
                    <div className="rounded-xl mb-6 overflow-hidden">
                      {recipe.image_url ? <img src={recipe.image_url} className="w-full object-contain rounded-xl"/> : (
                        <div className="border-2 border-dashed border-gray-100 rounded-xl h-48 flex items-center justify-center">
                          <span className="text-xs text-gray-400 flex items-center gap-1.5"><CameraIcon size={13} />No photo yet</span>
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
                        <div className="bg-amber-50 rounded-xl p-4 text-sm text-amber-800 leading-relaxed flex gap-2"><LightBulbIcon size={15} className="flex-shrink-0 mt-0.5" /><span>{recipe.notes}</span></div>
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
                      <input value={edited.prep_time || ""} onChange={e => updateEdited("prep_time", e.target.value)} placeholder="Time" className="bg-white border border-gray-200 rounded-full px-3 py-1 text-xs w-28 outline-none"/>
                      <input value={edited.servings || ""} onChange={e => updateEdited("servings", e.target.value)} placeholder="Servings" className="bg-white border border-gray-200 rounded-full px-3 py-1 text-xs w-28 outline-none"/>
                      <input value={edited.difficulty || ""} onChange={e => updateEdited("difficulty", e.target.value)} placeholder="Difficulty" className="bg-white border border-gray-200 rounded-full px-3 py-1 text-xs w-28 outline-none"/>
                      <select value={edited.category_id || ""} onChange={e => updateEdited("category_id", e.target.value)} className="bg-white border border-gray-200 rounded-full px-3 py-1 text-xs outline-none">
                        <option value="">No category</option>
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
                            <span className="text-xs text-gray-400 flex items-center gap-1"><CameraIcon size={13} />Click to add photo</span>
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
                          {aiLoading === "description" ? "Writing..." : "<SparkleIcon size={13} /> AI write"}
                        </button>
                      </div>
                      <textarea value={edited.description || ""} onChange={e => updateEdited("description", e.target.value)} placeholder="Add a description..." className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none outline-none" rows={2}/>
                    </div>
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">Ingredients <span className="text-gray-300 font-normal normal-case">(one per line)</span></div>
                        <button onClick={() => aiAssist("ingredients")} disabled={aiLoading === "ingredients"} className="text-xs text-orange-500 hover:text-orange-600 flex items-center gap-1">
                          {aiLoading === "ingredients" ? "Suggesting..." : "<SparkleIcon size={13} /> AI suggest"}
                        </button>
                      </div>
                      <textarea value={edited.ingredients || ""} onChange={e => updateEdited("ingredients", e.target.value)} placeholder="200g pasta&#10;100g cheese&#10;Salt" className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none outline-none" rows={6}/>
                    </div>
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">Instructions <span className="text-gray-300 font-normal normal-case">(one step per line)</span></div>
                        <button onClick={() => aiAssist("instructions")} disabled={aiLoading === "instructions"} className="text-xs text-orange-500 hover:text-orange-600 flex items-center gap-1">
                          {aiLoading === "instructions" ? "Improving..." : "<SparkleIcon size={13} /> AI improve"}
                        </button>
                      </div>
                      <textarea value={edited.instructions || ""} onChange={e => updateEdited("instructions", e.target.value)} placeholder="Boil water&#10;Add pasta&#10;Drain and serve" className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none outline-none" rows={8}/>
                    </div>
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">Notes</div>
                        <button onClick={() => aiAssist("notes")} disabled={aiLoading === "notes"} className="text-xs text-orange-500 hover:text-orange-600 flex items-center gap-1">
                          {aiLoading === "notes" ? "Generating..." : "<SparkleIcon size={13} /> AI generate"}
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
                  <div className="text-gray-300 mb-3"><PlateIcon size={40} /></div>
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
                  <TrashIcon size={16} /> Delete recipe
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