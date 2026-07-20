"use client"
import { useEffect, useState, useRef } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useParams } from "next/navigation"
import Navbar from "@/app/components/Navbar"
import ImageCropper from "@/app/components/ImageCropper"
import CollaboratorModal from "@/app/components/CollaboratorModal"
import NutritionPanel from "@/app/components/NutritionPanel"
import { toast } from "@/app/components/Toast"
import { PageSkeleton } from "@/app/components/Skeletons"
import CookingMode from "@/app/components/CookingMode"
import ServingsScaler from "@/app/components/ServingsScaler"
import { scaleIngredientLine } from "@/lib/scale"
import { safeHttpUrl } from "@/lib/sanitize"
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
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers"

import { HeartIcon, ShareIcon, PeopleIcon, PrintIcon, SearchIcon, ClockIcon, ChevronRightIcon, SortIcon, ListIcon, LeaveIcon, SparkleIcon, UserIcon, StarIcon, LightBulbIcon, CameraIcon, PlateIcon, TrashIcon, LockIcon, LinkIcon, CheckIcon, BookIcon } from "@/app/components/Icons"

function SortableRecipeItem({ recipe, isSelected, onClick, isOwner, isFavorited, onToggleFavorite, onRename, onDelete }: any) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: recipe.id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  const [menuOpen, setMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renameVal, setRenameVal] = useState(recipe.title || "")

  function submitRename() {
    const title = renameVal.trim() || "New Recipe"
    onRename(recipe.id, title)
    setRenaming(false)
  }

  return (
    <div ref={setNodeRef} style={style} onClick={renaming ? undefined : onClick}
      className={`mx-2 mb-0.5 px-3 py-2.5 rounded-xl cursor-pointer flex items-center gap-3 group transition-colors md:rounded-xl ${
        isSelected ? "border border-orange-300" : "hover:bg-gray-50 border border-transparent"
      } md:mx-2 mx-1 md:py-2.5 py-3.5 md:gap-3 gap-2`}>
      {isOwner && (
        <span {...attributes} {...listeners} onClick={e => e.stopPropagation()}
          className="text-gray-300 cursor-grab hidden md:flex items-center flex-shrink-0 -ml-1 hover:text-gray-400">
          <SortIcon size={12} />
        </span>
      )}
      <div className="flex-1 min-w-0">
        {renaming ? (
          <input
            autoFocus
            value={renameVal}
            onChange={e => setRenameVal(e.target.value)}
            onBlur={submitRename}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); submitRename() } if (e.key === "Escape") setRenaming(false) }}
            onClick={e => e.stopPropagation()}
            className={`text-sm font-medium w-full outline-none border-b pb-0.5 bg-transparent ${isSelected ? "border-orange-300 text-orange-700" : "border-gray-300 text-gray-800"}`}
            placeholder="Recipe name..."
          />
        ) : (
          <>
            <p className={`text-sm font-medium truncate leading-tight ${isSelected ? "text-orange-700" : "text-gray-800"}`}>{recipe.title || "New Recipe"}</p>
            {recipe.prep_time && (
              <p className="text-xs text-gray-400 mt-0.5 hidden md:flex items-center gap-1">
                <ClockIcon size={10} />{recipe.prep_time}
              </p>
            )}
          </>
        )}
      </div>
      {/* Favourite */}
      <button
        onClick={e => { e.stopPropagation(); onToggleFavorite(recipe.id) }}
        className={`flex-shrink-0 transition hidden md:block ${isFavorited ? "text-red-400" : "text-gray-200 opacity-0 group-hover:opacity-100 hover:text-red-300"}`}>
        <HeartIcon filled={isFavorited} size={14} />
      </button>
      {/* ... context menu (always visible on mobile, hover on desktop) */}
      {isOwner && (
        <div className="relative flex-shrink-0" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="md:opacity-0 md:group-hover:opacity-100 text-gray-400 hover:text-gray-600 transition rounded p-0.5 text-base leading-none font-bold"
          >⋯</button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 bottom-full mb-1 bg-white border border-gray-100 rounded-xl shadow-lg z-50 py-1 min-w-[120px]">
                <button
                  onClick={() => { setMenuOpen(false); setRenameVal(recipe.title || ""); setRenaming(true) }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-t-xl">
                  Rename
                </button>
                <button
                  onClick={() => { setMenuOpen(false); onDelete(recipe.id) }}
                  className="w-full text-left px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded-b-xl">
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      )}
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
  const [cookingMode, setCookingMode] = useState(false)
  const [resumeStepIndex, setResumeStepIndex] = useState<number | undefined>(undefined)
  const [scaleFactor, setScaleFactor] = useState(1)
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
  const [isViewer, setIsViewer] = useState(false)
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
  const [mobileCardMenuId, setMobileCardMenuId] = useState<string | null>(null)
  const [mobileCardRename, setMobileCardRename] = useState("")
  const [showCopyModal, setShowCopyModal] = useState(false)
  const [userCookbooks, setUserCookbooks] = useState<any[]>([])
  const [copyLoading, setCopyLoading] = useState(false)
  const [copyDone, setCopyDone] = useState<string | null>(null)
  const [planStatus, setPlanStatus] = useState<any>(null)

  const focusedFieldRef = useRef<string | null>(null)
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [historyVersions, setHistoryVersions] = useState<any[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [fieldFocus, setFieldFocus] = useState<{[key: string]: string}>({})
  const [fieldCursors, setFieldCursors] = useState<{[key: string]: {field: string, pos: number}}>({})
  const cursorUpdateRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
      fetch("/api/subscription").then(r => r.ok ? r.json() : null).then(d => d && setPlanStatus(d)).catch(() => {})
    }
  }, [status])

  // Landing here from a "timer running" link (push notification or the
  // global timer indicator) jumps straight back into cooking mode at the
  // step the timer was started on, instead of just opening the recipe.
  const resumeConsumedRef = useRef(false)
  useEffect(() => {
    if (resumeConsumedRef.current || !selectedRecipe) return
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get("resumeCooking") !== "1") return
    resumeConsumedRef.current = true
    const step = urlParams.get("resumeStep")
    setResumeStepIndex(step !== null ? parseInt(step, 10) : undefined)
    setCookingMode(true)
  }, [selectedRecipe])

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
    const focusKey = session.user.email.replace(/[.#$[\]]/g, "_")
    return () => {
      off(allPresenceRef)
      clearInterval(interval)
      set(presenceRef, null)
      set(ref(db, `cookbooks/${params.id}/focus/${focusKey}`), null).catch(() => {})
      set(ref(db, `cookbooks/${params.id}/cursor/${focusKey}`), null).catch(() => {})
    }
  }, [session, params.id])

  useEffect(() => {
    if (!params.id || !session?.user?.email) return
    const focusRef = ref(db, `cookbooks/${params.id}/focus`)
    const myKey = session.user.email.replace(/[.#$[\]]/g, "_")
    const unsub = onValue(focusRef, snap => {
      const data = snap.val() || {}
      const others: {[key: string]: string} = {}
      for (const [k, v] of Object.entries(data)) {
        if (k !== myKey && v) others[k] = v as string
      }
      setFieldFocus(others)
    })
    return unsub
  }, [params.id, session])

  useEffect(() => {
    if (!params.id || !session?.user?.email) return
    const myKey = session.user.email.replace(/[.#$[\]]/g, "_")
    const cursorRefPath = ref(db, `cookbooks/${params.id}/cursor`)
    const unsub = onValue(cursorRefPath, snap => {
      const data = snap.val() || {}
      const others: {[key: string]: {field: string, pos: number}} = {}
      for (const [k, v] of Object.entries(data)) {
        if (k !== myKey && v && typeof v === "object") others[k] = v as {field: string, pos: number}
      }
      setFieldCursors(others)
    })
    return unsub
  }, [params.id, session])

  useEffect(() => {
    if (!params.id) return
    const recipesRef = ref(db, `cookbooks/${params.id}/lastUpdate`)
    let initialized = false
    onValue(recipesRef, async (snapshot) => {
      if (!initialized) { initialized = true; return }
      const data = snapshot.val()
      if (data && data.updatedBy !== session?.user?.email) {
        // If the cookbook was deleted while we're viewing it, leave gracefully
        const check = await fetch(`/api/cookbooks/${params.id}`)
        if (check.status === 404) {
          toast.info("This cookbook was deleted by its owner.")
          router.push("/dashboard")
          return
        }
        fetchRecipes()
      }
    })
    return () => off(recipesRef)
  }, [params.id, session])

  useEffect(() => {
    if (!params.id || !selectedRecipe?.id) return
    const fieldRef = ref(db, `cookbooks/${params.id}/recipe/${selectedRecipe.id}`)
    let initialized = false
    onValue(fieldRef, (snapshot) => {
      if (!initialized) { initialized = true; return }
      const data = snapshot.val()
      if (!data || data._by === session?.user?.email) return
      const SYNC_FIELDS = ["title", "prep_time", "servings", "difficulty", "category_id", "description", "ingredients", "instructions", "notes", "source_url", "image_url"]
      setEdited((prev: any) => {
        if (!prev) return prev
        const patch: any = {}
        for (const f of SYNC_FIELDS) {
          if (focusedFieldRef.current !== f && data[f] !== undefined) patch[f] = data[f]
        }
        return { ...prev, ...patch }
      })
    })
    return () => off(fieldRef)
  }, [params.id, selectedRecipe?.id, session])

  useEffect(() => {
    if (filteredRecipes.length > 0 && !selectedRecipe) {
      setSelectedRecipe(filteredRecipes[0])
    }
  }, [activeCategory])

  // Scaling is per-recipe — snap back to 1× when switching
  useEffect(() => { setScaleFactor(1) }, [selectedRecipe?.id])

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
    } else if (selectedRecipe) {
      // Someone else may have just saved changes to the recipe we're
      // currently viewing — re-sync it instead of leaving it stale until
      // the viewer manually clicks away and back (or refreshes).
      const fresh = sorted.find((r: any) => r.id === selectedRecipe.id)
      if (fresh && !editMode) setSelectedRecipe(fresh)
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
          const mine = (collaboratorsData.collaborators || []).find(
            (c: any) => c.id === profileData.user.id && c.status === "accepted"
          )
          // Editors get full edit access; viewers can see a private cookbook but not change it
          setIsCollaborator(!!mine && mine.role !== "viewer")
          setIsViewer(!!mine && mine.role === "viewer")
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
    const toSave = { ...edited, title: edited.title?.trim() || "New Recipe" }
    if (autoSaveTimeoutRef.current) { clearTimeout(autoSaveTimeoutRef.current); autoSaveTimeoutRef.current = null }
    await fetch(`/api/recipes/${edited.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...toSave, _saveVersion: true }),
    })
    setSelectedRecipe(toSave)
    setRecipes(prev => prev.map(r => r.id === toSave.id ? toSave : r))
    setEdited(toSave)
    setSaving(false)
    setLastSaved("Saved")
    setEditMode(false)
    await notifyFirebase()
  }

  async function autoSaveRecipe(data: any) {
    if (!data?.id) return
    const toSave = { ...data, title: data.title?.trim() || "New Recipe" }
    await fetch(`/api/recipes/${toSave.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toSave),
    })
    setSelectedRecipe(toSave)
    setRecipes(prev => prev.map(r => r.id === toSave.id ? toSave : r))
    setLastSaved("Auto-saved")
  }

  async function fetchHistory() {
    if (!selectedRecipe) return
    setHistoryLoading(true)
    setShowHistory(true)
    const res = await fetch(`/api/recipes/${selectedRecipe.id}/versions`)
    const data = await res.json()
    setHistoryVersions(data.versions || [])
    setHistoryLoading(false)
  }

  async function restoreVersion(versionId: number) {
    if (!selectedRecipe) return
    const res = await fetch(`/api/recipes/${selectedRecipe.id}/versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version_id: versionId }),
    })
    const data = await res.json()
    if (data.recipe) {
      setEdited({ ...selectedRecipe, ...data.recipe })
      setEditMode(true)
      setShowHistory(false)
      setLastSaved("Restored — review and save")
    }
  }

  const emailKey = session?.user?.email?.replace(/[.#$[\]]/g, "_") || ""
  function handleFieldFocus(field: string) {
    focusedFieldRef.current = field
    if (editMode && emailKey) set(ref(db, `cookbooks/${params.id}/focus/${emailKey}`), field).catch(() => {})
  }
  function handleFieldBlur() {
    focusedFieldRef.current = null
    if (emailKey) {
      set(ref(db, `cookbooks/${params.id}/focus/${emailKey}`), null).catch(() => {})
      if (cursorUpdateRef.current) clearTimeout(cursorUpdateRef.current)
      set(ref(db, `cookbooks/${params.id}/cursor/${emailKey}`), null).catch(() => {})
    }
  }
  function isTypedByOther(field: string) { return Object.values(fieldFocus).includes(field) }
  function getTyperName(field: string) {
    const key = Object.entries(fieldFocus).find(([, f]) => f === field)?.[0]
    if (!key) return ""
    const email = key.replace(/_/g, ".")
    return activeUsers.find((u: any) => u.email === email)?.name?.split(" ")[0] || "Someone"
  }
  function emitCursor(field: string, pos: number) {
    if (!emailKey || !editMode) return
    if (cursorUpdateRef.current) clearTimeout(cursorUpdateRef.current)
    cursorUpdateRef.current = setTimeout(() => {
      set(ref(db, `cookbooks/${params.id}/cursor/${emailKey}`), { field, pos }).catch(() => {})
    }, 300)
  }
  function getLockedLabel(field: string, text?: string): string {
    const name = getTyperName(field)
    if (!text) return `${name} is editing`
    const entry = Object.entries(fieldCursors).find(([, v]) => v.field === field)
    if (!entry || typeof entry[1].pos !== "number") return `${name} is editing`
    const lines = text.split("\n")
    const line = text.substring(0, Math.min(entry[1].pos, text.length)).split("\n").length
    return lines.length > 1 ? `${name} · line ${line}/${lines.length}` : `${name} is editing`
  }

  async function createRecipe() {
    const res = await fetch("/api/recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "",
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

  async function renameRecipe(id: string, title: string) {
    await fetch(`/api/recipes/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    })
    setRecipes(prev => prev.map(r => r.id === id ? { ...r, title } : r))
    if (selectedRecipe?.id === id) setSelectedRecipe((prev: any) => prev ? { ...prev, title } : prev)
    if (edited?.id === id) setEdited((prev: any) => prev ? { ...prev, title } : prev)
  }

  async function deleteRecipe(id: string) {
    setShowDeleteModal(true)
    setRecipeToDelete(id)
  }

  async function confirmDelete() {
    if (!recipeToDelete) return
    const idx = recipes.findIndex((r: any) => r.id === recipeToDelete)
    const remaining = recipes.filter((r: any) => r.id !== recipeToDelete)
    const nextRecipe = remaining[Math.min(idx, remaining.length - 1)] || null
    await fetch(`/api/recipes/${recipeToDelete}`, { method: "DELETE" })
    setShowDeleteModal(false)
    setRecipeToDelete(null)
    setRecipes(remaining)
    setSelectedRecipe(nextRecipe)
    setEdited(nextRecipe ? { ...nextRecipe } : null)
    setEditMode(false)
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
    if (!edited || !planStatus?.canUseAI) return
    setAiLoading(type)
    const res = await fetch("/api/ai-assist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, recipe: edited }),
    })
    if (res.status === 403) {
      // Limit hit mid-session — refresh plan status
      fetch("/api/subscription").then(r => r.ok ? r.json() : null).then(d => d && setPlanStatus(d)).catch(() => {})
      setAiLoading(null)
      return
    }
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
    setEdited((prev: any) => {
      const next = { ...prev, [field]: value }
      if (selectedRecipe && session?.user?.email) {
        if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current)
        syncTimeoutRef.current = setTimeout(() => {
          set(ref(db, `cookbooks/${params.id}/recipe/${selectedRecipe.id}`), {
            ...next, _by: session.user!.email, _ts: Date.now(),
          })
        }, 400)
      }
      if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current)
      autoSaveTimeoutRef.current = setTimeout(() => autoSaveRecipe(next), 3000)
      return next
    })
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

  async function openCopyModal() {
    setShowCopyModal(true)
    setCopyDone(null)
    if (userCookbooks.length === 0) {
      const res = await fetch("/api/cookbooks")
      const data = await res.json()
      setUserCookbooks(data.cookbooks || [])
    }
  }

  async function copyRecipeToBook(targetCookbookId: string, allowDuplicate = false) {
    if (!recipe) return
    setCopyLoading(true)
    const res = await fetch("/api/recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cookbook_id: targetCookbookId,
        title: recipe.title,
        description: recipe.description,
        ingredients: recipe.ingredients,
        instructions: recipe.instructions,
        prep_time: recipe.prep_time,
        servings: recipe.servings,
        difficulty: recipe.difficulty,
        source_url: recipe.source_url,
        notes: recipe.notes,
        image_url: recipe.image_url,
        nutrition: recipe.nutrition ? (typeof recipe.nutrition === "string" ? JSON.parse(recipe.nutrition) : recipe.nutrition) : null,
        copy_nutrition: true,
        allow_duplicate: allowDuplicate,
        sort_order: 0,
      }),
    })
    if (res.status === 409) {
      setCopyLoading(false)
      if (confirm(`You already have "${recipe.title}" in that cookbook. Copy it again anyway?`)) {
        return copyRecipeToBook(targetCookbookId, true)
      }
      return
    }
    const picked = userCookbooks.find((c: any) => c.id === targetCookbookId)
    setCopyDone(picked?.title || "your cookbook")
    setCopyLoading(false)
  }

  if (status === "loading") {
    return <PageSkeleton />
  }

  const recipe = editMode ? edited : selectedRecipe

  return (
    <div className="flex flex-col md:overflow-hidden md:h-[100svh]">
      <Navbar />
      <div className="flex flex-1 md:overflow-hidden md:min-h-0">

        {/* ── MOBILE COOKBOOK LIST (full-screen, replaces sidebar on mobile) ── */}
        {mobileView === "list" && (
          <div className="md:hidden flex flex-col w-full">

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
                  className="sf-overlay-pill absolute top-4 left-4 flex items-center gap-1.5 bg-white/90 backdrop-blur-sm rounded-xl px-3 py-2 text-xs font-medium text-gray-700 shadow-sm">
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
                    onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/share/cookbook/${params.id}`); toast.success("Link copied!") }}
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
                {(isCollaborator || isViewer) && !isOwner && (
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
                      {cat.emoji === "📋" ? <ListIcon size={13} /> : cat.emoji} {cat.name}
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
              <div className="bg-gray-50 px-4 pt-2 pb-4">
                <div className="bg-white border border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center p-10 text-center">
                  <div className="text-gray-300 mb-3"><ListIcon size={40} /></div>
                  <p className="text-gray-500 font-medium text-sm">{search ? "No matching recipes" : "No recipes yet"}</p>
                  {canEdit && !search && (
                    <button onClick={createRecipe} className="mt-4 px-5 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-semibold shadow-sm">
                      Add your first recipe
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 px-4 pt-2 pb-4">
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
                        <p className="font-semibold text-gray-900 text-[15px] leading-snug truncate">{r.title || "New Recipe"}</p>
                        {r.prep_time && (
                          <p className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                            <ClockIcon size={11} />
                            {r.prep_time}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={e => { e.stopPropagation(); toggleFavorite(r.id) }}
                          className={`transition ${favorites.has(r.id) ? "text-red-400" : "text-gray-200 active:text-red-300"}`}>
                          <HeartIcon filled={favorites.has(r.id)} size={18} />
                        </button>
                        {canEdit && (
                          <button
                            onClick={e => { e.stopPropagation(); setMobileCardRename(r.title || ""); setMobileCardMenuId(r.id) }}
                            className="text-gray-400 active:text-gray-600 text-lg font-bold px-1 leading-none">
                            ⋯
                          </button>
                        )}
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
                onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/share/cookbook/${params.id}`); toast.success("Link copied!") }}
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
            {(isCollaborator || isViewer) && !isOwner && (
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
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm border transition text-gray-600 ${activeCategory === "all" && !showFavoritesOnly ? "border-orange-300 font-medium" : "border-transparent hover:bg-gray-50"}`}>
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
                      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm border transition text-gray-600 ${isActive ? "border-orange-300 font-medium" : "border-transparent hover:bg-gray-50"}`}>
                      <span className="text-base leading-none flex-shrink-0">{cat.emoji === "📋" ? <ListIcon size={15} className="text-gray-400" /> : cat.emoji}</span>
                      <span className="flex-1 min-w-0 text-left truncate">{cat.name}</span>
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
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToVerticalAxis, restrictToParentElement]}>
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
                    onRename={renameRecipe}
                    onDelete={deleteRecipe}
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

        <div className={`flex-col bg-gray-50 md:overflow-hidden min-w-0 ${mobileView === "detail" ? "flex" : "hidden"} md:flex md:flex-1`}>
          {/* Mobile header — back + title + primary action + overflow */}
          <div className="md:hidden flex items-center gap-2 px-3 py-3 bg-white border-b border-gray-100 flex-shrink-0">
            <button onClick={() => withUnsavedCheck(() => setMobileView("list"))} className="p-1.5 -ml-1 rounded-lg text-orange-500 flex-shrink-0">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
            </button>
            <span onClick={() => withUnsavedCheck(() => setMobileView("list"))} className="flex-1 min-w-0 font-medium text-gray-900 truncate text-sm cursor-pointer active:text-orange-500">{recipe?.title || cookbookInfo?.title}</span>
            {editMode ? (
              <>
                <button onClick={cancelEdit} className="text-sm text-gray-400 px-2 py-1">Cancel</button>
                <button onClick={fetchHistory} className="p-1.5 text-gray-400 rounded-lg"><ClockIcon size={18} /></button>
                <button onClick={saveRecipe} disabled={saving} className="text-sm font-semibold text-white bg-orange-500 px-3 py-1.5 rounded-lg disabled:opacity-50">
                  {saving ? "Saving…" : "Save"}
                </button>
              </>
            ) : (
              <>
                {canEdit && recipe && (
                  <button onClick={startEdit} className="text-sm font-medium text-orange-500 px-2 py-1">Edit</button>
                )}
                {!canEdit && recipe && (
                  <button onClick={openCopyModal} className="text-sm font-medium text-orange-500 px-2 py-1">Save</button>
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
                <p className="text-sm font-semibold text-gray-900 truncate">{recipe.title || "New Recipe"}</p>
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
              {!canEdit && recipe && !editMode && (
                <button onClick={openCopyModal} className="px-4 py-1.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition">
                  Save to my cookbook
                </button>
              )}
              {canEdit && recipe && !editMode && (
                <button onClick={openCopyModal} title="Copy this recipe to another of your cookbooks" className="px-3 py-1.5 border border-gray-200 text-gray-500 rounded-lg text-sm hover:bg-gray-50 transition">
                  Copy to…
                </button>
              )}
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
                  <button onClick={fetchHistory} className="px-3 py-1.5 border border-gray-200 text-gray-400 rounded-lg text-sm hover:bg-gray-50 transition flex items-center gap-1.5"><ClockIcon size={13} />History</button>
                  <button onClick={cancelEdit} className="px-4 py-1.5 border border-gray-200 text-gray-500 rounded-lg text-sm hover:bg-gray-50 transition">Cancel</button>
                  <button onClick={saveRecipe} disabled={saving} className="px-4 py-1.5 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50 transition">
                    {saving ? "Saving..." : "Save"}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="px-4 py-4 md:px-8 md:py-6 md:flex-1 md:overflow-y-auto" id="recipe-content">
            {recipe ? (
              <>
                {!editMode ? (
                  <>
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <h1 className="text-2xl font-medium min-w-0 break-words">{recipe.title || "New Recipe"}</h1>
                      <button onClick={() => toggleFavorite(recipe.id)} className={`flex-shrink-0 transition ${favorites.has(recipe.id) ? "text-red-400" : "text-gray-300 hover:text-red-300"}`}>
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
                      {recipe.image_url ? <img src={recipe.image_url} className="w-full max-h-[400px] object-contain rounded-xl bg-gray-50"/> : (
                        <div className="border-2 border-dashed border-gray-100 rounded-xl h-48 flex items-center justify-center">
                          <span className="text-xs text-gray-400 flex items-center gap-1.5"><CameraIcon size={13} />No photo yet</span>
                        </div>
                      )}
                    </div>
                    {recipe.instructions && (
                      <button
                        onClick={() => setCookingMode(true)}
                        className="w-full md:w-auto flex items-center justify-center gap-2 bg-orange-500 text-white px-6 py-3 rounded-2xl text-sm font-semibold hover:bg-orange-600 active:scale-[0.99] transition mb-6">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>
                        Start cooking
                      </button>
                    )}
                    {recipe.ingredients && (
                      <div id="ingredients" className="mb-6">
                        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
                          <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                            Ingredients
                            {scaleFactor !== 1 && <span className="ml-2 normal-case font-normal text-orange-500">scaled ×{Math.round(scaleFactor * 100) / 100}</span>}
                          </div>
                          <ServingsScaler servings={recipe.servings} factor={scaleFactor} onChange={setScaleFactor} />
                        </div>
                        {recipe.ingredients.split("\n").filter(Boolean).map((ing: string, i: number) => (
                          <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-50">
                            <input type="checkbox" className="w-3.5 h-3.5 accent-orange-500 flex-shrink-0"/>
                            <span className="text-sm">{scaleIngredientLine(ing, scaleFactor)}</span>
                          </div>
                        ))}
                        {scaleFactor !== 1 && (
                          <p className="text-[11px] text-gray-300 mt-2">Cooking times aren't scaled — adjust those by eye.</p>
                        )}
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
                    <NutritionPanel recipe={recipe} readOnly={!canEdit}/>
                    <div className="flex items-center gap-3 mt-4 flex-wrap">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/share/recipe/${recipe.id}`)
                          toast.success("Recipe link copied to clipboard!")
                        }}
                        className="px-3 py-1.5 border border-orange-200 text-orange-500 rounded-lg text-xs hover:bg-orange-50 transition inline-flex items-center gap-1.5">
                        <ShareIcon size={11} />Share recipe
                      </button>
                      <RecipePDFButton recipe={recipe} />
                      {safeHttpUrl(recipe.source_url) && (
                        <a href={safeHttpUrl(recipe.source_url)} target="_blank" rel="noopener noreferrer" className="text-xs text-orange-500 inline-flex items-center gap-1"><LinkIcon size={11} />View original source</a>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <input value={edited.title || ""} onChange={e => { if (!isTypedByOther("title")) updateEdited("title", e.target.value) }} onFocus={() => handleFieldFocus("title")} onBlur={handleFieldBlur} readOnly={isTypedByOther("title")} className={`text-2xl font-medium bg-transparent border-b outline-none w-full mb-4 pb-2 placeholder:text-gray-300 transition ${isTypedByOther("title") ? "border-amber-300 cursor-not-allowed" : "border-gray-200"}`} placeholder="Type recipe name here..."/>
                    <div className="flex gap-2 mb-4 flex-wrap">
                      <input value={edited.prep_time || ""} onChange={e => { if (!isTypedByOther("prep_time")) updateEdited("prep_time", e.target.value) }} onFocus={() => handleFieldFocus("prep_time")} onBlur={handleFieldBlur} readOnly={isTypedByOther("prep_time")} placeholder="Time" className={`bg-white border rounded-full px-3 py-1 text-xs w-28 outline-none transition ${isTypedByOther("prep_time") ? "border-amber-300 bg-amber-50 cursor-not-allowed" : "border-gray-200"}`}/>
                      <input value={edited.servings || ""} onChange={e => { if (!isTypedByOther("servings")) updateEdited("servings", e.target.value) }} onFocus={() => handleFieldFocus("servings")} onBlur={handleFieldBlur} readOnly={isTypedByOther("servings")} placeholder="Servings" className={`bg-white border rounded-full px-3 py-1 text-xs w-28 outline-none transition ${isTypedByOther("servings") ? "border-amber-300 bg-amber-50 cursor-not-allowed" : "border-gray-200"}`}/>
                      <select value={edited.difficulty || ""} onChange={e => { if (!isTypedByOther("difficulty")) updateEdited("difficulty", e.target.value) }} onFocus={() => handleFieldFocus("difficulty")} onBlur={handleFieldBlur} className={`bg-white border rounded-full px-3 py-1 text-xs outline-none transition ${isTypedByOther("difficulty") ? "border-amber-300 bg-amber-50 pointer-events-none" : "border-gray-200 cursor-pointer"}`}>
                        <option value="">Difficulty</option>
                        <option value="Easy">Easy</option>
                        <option value="Medium">Medium</option>
                        <option value="Hard">Hard</option>
                        <option value="Expert">Expert</option>
                      </select>
                      <select value={edited.category_id || ""} onChange={e => { if (!isTypedByOther("category_id")) updateEdited("category_id", e.target.value) }} onFocus={() => handleFieldFocus("category_id")} onBlur={handleFieldBlur} className={`bg-white border rounded-full px-3 py-1 text-xs outline-none transition ${isTypedByOther("category_id") ? "border-amber-300 bg-amber-50 pointer-events-none" : "border-gray-200"}`}>
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
                    {planStatus && !planStatus.canUseAI && planStatus.weeklyLimit !== null && (
                      <div className="mb-4 bg-orange-50 border border-orange-200 rounded-xl px-3 py-2 text-xs text-orange-700 flex items-center gap-2">
                        <SparkleIcon size={13} />
                        <span>You've used all your AI features for this week. They'll reset next week.</span>
                      </div>
                    )}
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs font-medium text-gray-400 uppercase tracking-wide flex items-center gap-2">
                          Description
                          {isTypedByOther("description") && <span className="normal-case font-normal text-amber-500"><LockIcon size={11} className="inline -mt-0.5 mr-0.5" />{getLockedLabel("description", edited?.description)}</span>}
                        </div>
                        <button onClick={() => aiAssist("description")} disabled={!planStatus?.canUseAI || aiLoading === "description"} className="text-xs text-orange-500 hover:text-orange-600 flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed">
                          {aiLoading === "description" ? "Writing..." : <><SparkleIcon size={13} /> AI write</>}
                        </button>
                      </div>
                      <textarea value={edited.description || ""} onChange={e => { if (!isTypedByOther("description")) updateEdited("description", e.target.value) }} onFocus={() => handleFieldFocus("description")} onBlur={handleFieldBlur} onSelect={e => emitCursor("description", (e.target as HTMLTextAreaElement).selectionStart)} readOnly={isTypedByOther("description")} placeholder="Add a description..." className={`w-full bg-white border rounded-xl px-3 py-2 text-sm resize-none outline-none transition ${isTypedByOther("description") ? "ring-2 ring-amber-200 border-amber-300 bg-amber-50/30 cursor-not-allowed" : "border-gray-200"}`} rows={2}/>
                    </div>
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs font-medium text-gray-400 uppercase tracking-wide flex items-center gap-2">
                          Ingredients
                          {isTypedByOther("ingredients") && <span className="normal-case font-normal text-amber-500"><LockIcon size={11} className="inline -mt-0.5 mr-0.5" />{getTyperName("ingredients")} is editing</span>}
                        </div>
                        <button onClick={() => aiAssist("ingredients")} disabled={!planStatus?.canUseAI || aiLoading === "ingredients"} className="text-xs text-orange-500 hover:text-orange-600 flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed">
                          {aiLoading === "ingredients" ? "Suggesting..." : <><SparkleIcon size={13} /> AI suggest</>}
                        </button>
                      </div>
                      <div className={`border rounded-xl overflow-hidden ${isTypedByOther("ingredients") ? "ring-2 ring-amber-200 border-amber-300" : "border-gray-200"}`}>
                        {(edited.ingredients || "").split("\n").concat(edited.ingredients ? [] : [""]).map((ing: string, i: number, arr: string[]) => (
                          <div key={i} className="flex items-center gap-2.5 px-3 border-b border-gray-100 last:border-0 group">
                            <div className="w-4 h-4 rounded-full border-2 border-gray-200 flex-shrink-0" />
                            <input
                              data-ing={i}
                              value={ing}
                              readOnly={isTypedByOther("ingredients")}
                              onChange={e => {
                                if (isTypedByOther("ingredients")) return
                                const lines = (edited.ingredients || "").split("\n")
                                if (!edited.ingredients && lines.length === 1 && lines[0] === "") lines[0] = ""
                                lines[i] = e.target.value
                                updateEdited("ingredients", lines.join("\n"))
                              }}
                              onKeyDown={e => {
                                if (isTypedByOther("ingredients")) return
                                const lines = (edited.ingredients || "").split("\n").length > 0 ? (edited.ingredients || "").split("\n") : [""]
                                if (e.key === "Enter") {
                                  e.preventDefault()
                                  const arr2 = [...lines]
                                  arr2.splice(i + 1, 0, "")
                                  updateEdited("ingredients", arr2.join("\n"))
                                  setTimeout(() => { const els = document.querySelectorAll<HTMLInputElement>("[data-ing]"); els[i + 1]?.focus() }, 0)
                                } else if (e.key === "Backspace" && ing === "" && lines.length > 1) {
                                  e.preventDefault()
                                  const arr2 = [...lines]
                                  arr2.splice(i, 1)
                                  updateEdited("ingredients", arr2.join("\n"))
                                  setTimeout(() => { const els = document.querySelectorAll<HTMLInputElement>("[data-ing]"); els[Math.max(0, i - 1)]?.focus() }, 0)
                                }
                              }}
                              onFocus={() => handleFieldFocus("ingredients")}
                              onBlur={handleFieldBlur}
                              placeholder={i === 0 ? "e.g. 200g pasta" : "Add ingredient..."}
                              className={`flex-1 text-sm outline-none bg-transparent py-2.5 min-w-0 ${isTypedByOther("ingredients") ? "cursor-not-allowed" : ""}`}
                            />
                            {arr.length > 1 && (
                              <button
                                onClick={() => {
                                  if (isTypedByOther("ingredients")) return
                                  const lines = (edited.ingredients || "").split("\n")
                                  lines.splice(i, 1)
                                  updateEdited("ingredients", lines.join("\n"))
                                }}
                                className={`text-gray-200 text-xs flex-shrink-0 transition opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 ${isTypedByOther("ingredients") ? "cursor-not-allowed" : "hover:text-red-400"}`}
                              >✕</button>
                            )}
                          </div>
                        ))}
                        <button
                          onClick={() => {
                            if (isTypedByOther("ingredients")) return
                            const current = edited.ingredients || ""
                            updateEdited("ingredients", current ? current + "\n" : "")
                            setTimeout(() => { const els = document.querySelectorAll<HTMLInputElement>("[data-ing]"); els[els.length - 1]?.focus() }, 0)
                          }}
                          className={`w-full py-2 text-xs transition flex items-center justify-center gap-1 ${isTypedByOther("ingredients") ? "text-gray-300 cursor-not-allowed" : "text-gray-400 hover:text-orange-500 hover:bg-orange-50"}`}
                        >
                          <span className="text-base leading-none">+</span> Add ingredient
                        </button>
                      </div>
                    </div>
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs font-medium text-gray-400 uppercase tracking-wide flex items-center gap-2">
                          <span>Instructions</span>
                          {isTypedByOther("instructions") && <span className="normal-case font-normal text-amber-500"><LockIcon size={11} className="inline -mt-0.5 mr-0.5" />{getLockedLabel("instructions", edited?.instructions)}</span>}
                        </div>
                        <button onClick={() => aiAssist("instructions")} disabled={!planStatus?.canUseAI || aiLoading === "instructions"} className="text-xs text-orange-500 hover:text-orange-600 flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed">
                          {aiLoading === "instructions" ? "Improving..." : <><SparkleIcon size={13} /> AI improve</>}
                        </button>
                      </div>
                      <div className={`border rounded-xl overflow-hidden ${isTypedByOther("instructions") ? "ring-2 ring-amber-200 border-amber-300" : "border-gray-200"}`}>
                        {(edited.instructions || "").split("\n").concat(edited.instructions ? [] : [""]).map((step: string, i: number, arr: string[]) => (
                          <div key={i} className="flex items-start gap-2.5 px-3 border-b border-gray-100 last:border-0 group">
                            <div className="w-5 h-5 rounded-full bg-orange-50 text-orange-600 text-[10px] font-semibold flex items-center justify-center flex-shrink-0 mt-2.5">{i + 1}</div>
                            <textarea
                              data-step={i}
                              value={step}
                              rows={1}
                              readOnly={isTypedByOther("instructions")}
                              ref={el => { if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px" } }}
                              onChange={e => {
                                if (isTypedByOther("instructions")) return
                                const lines = (edited.instructions || "").split("\n")
                                lines[i] = e.target.value.replace(/\n/g, " ")
                                updateEdited("instructions", lines.join("\n"))
                              }}
                              onKeyDown={e => {
                                if (isTypedByOther("instructions")) return
                                const lines = (edited.instructions || "").split("\n")
                                if (e.key === "Enter") {
                                  e.preventDefault()
                                  const arr2 = [...lines]
                                  arr2.splice(i + 1, 0, "")
                                  updateEdited("instructions", arr2.join("\n"))
                                  setTimeout(() => { const els = document.querySelectorAll<HTMLTextAreaElement>("[data-step]"); els[i + 1]?.focus() }, 0)
                                } else if (e.key === "Backspace" && step === "" && lines.length > 1) {
                                  e.preventDefault()
                                  const arr2 = [...lines]
                                  arr2.splice(i, 1)
                                  updateEdited("instructions", arr2.join("\n"))
                                  setTimeout(() => { const els = document.querySelectorAll<HTMLTextAreaElement>("[data-step]"); els[Math.max(0, i - 1)]?.focus() }, 0)
                                }
                              }}
                              onFocus={() => handleFieldFocus("instructions")}
                              onBlur={handleFieldBlur}
                              placeholder={i === 0 ? "e.g. Boil a large pot of salted water" : "Add step..."}
                              className={`flex-1 text-sm outline-none bg-transparent py-2.5 min-w-0 resize-none overflow-hidden ${isTypedByOther("instructions") ? "cursor-not-allowed" : ""}`}
                            />
                            {arr.length > 1 && (
                              <button
                                onClick={() => {
                                  if (isTypedByOther("instructions")) return
                                  const lines = (edited.instructions || "").split("\n")
                                  lines.splice(i, 1)
                                  updateEdited("instructions", lines.join("\n"))
                                }}
                                className={`text-gray-200 text-xs flex-shrink-0 transition opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 mt-2 ${isTypedByOther("instructions") ? "cursor-not-allowed" : "hover:text-red-400"}`}
                              >✕</button>
                            )}
                          </div>
                        ))}
                        <button
                          onClick={() => {
                            if (isTypedByOther("instructions")) return
                            const current = edited.instructions || ""
                            updateEdited("instructions", current ? current + "\n" : "")
                            setTimeout(() => { const els = document.querySelectorAll<HTMLTextAreaElement>("[data-step]"); els[els.length - 1]?.focus() }, 0)
                          }}
                          className={`w-full py-2 text-xs transition flex items-center justify-center gap-1 ${isTypedByOther("instructions") ? "text-gray-300 cursor-not-allowed" : "text-gray-400 hover:text-orange-500 hover:bg-orange-50"}`}
                        >
                          <span className="text-base leading-none">+</span> Add step
                        </button>
                      </div>
                    </div>
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs font-medium text-gray-400 uppercase tracking-wide flex items-center gap-2">
                          Notes
                          {isTypedByOther("notes") && <span className="normal-case font-normal text-amber-500"><LockIcon size={11} className="inline -mt-0.5 mr-0.5" />{getLockedLabel("notes", edited?.notes)}</span>}
                        </div>
                        <button onClick={() => aiAssist("notes")} disabled={!planStatus?.canUseAI || aiLoading === "notes"} className="text-xs text-orange-500 hover:text-orange-600 flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed">
                          {aiLoading === "notes" ? "Generating..." : <><SparkleIcon size={13} /> AI generate</>}
                        </button>
                      </div>
                      <textarea value={edited.notes || ""} onChange={e => { if (!isTypedByOther("notes")) updateEdited("notes", e.target.value) }} onFocus={() => handleFieldFocus("notes")} onBlur={handleFieldBlur} onSelect={e => emitCursor("notes", (e.target as HTMLTextAreaElement).selectionStart)} readOnly={isTypedByOther("notes")} placeholder="Tips, variations, substitutions..." className={`w-full bg-white border rounded-xl px-3 py-2 text-sm resize-none outline-none transition ${isTypedByOther("notes") ? "ring-2 ring-amber-200 border-amber-300 bg-amber-50/30 cursor-not-allowed" : "border-gray-200"}`} rows={3}/>
                    </div>
                    <div className="mb-4">
                      <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Source URL</div>
                      <input value={edited.source_url || ""} onChange={e => { if (!isTypedByOther("source_url")) updateEdited("source_url", e.target.value) }} onFocus={() => handleFieldFocus("source_url")} onBlur={handleFieldBlur} readOnly={isTypedByOther("source_url")} placeholder="https://..." className={`w-full bg-white border rounded-xl px-3 py-2 text-sm outline-none transition ${isTypedByOther("source_url") ? "ring-2 ring-amber-200 border-amber-300 bg-amber-50/30 cursor-not-allowed" : "border-gray-200"}`}/>
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
                  if (section === "Top") {
                    // Desktop: #recipe-content is its own scroll region. Mobile: the page itself scrolls.
                    document.getElementById("recipe-content")?.scrollTo({ top: 0, behavior: "smooth" })
                    window.scrollTo({ top: 0, behavior: "smooth" })
                  } else {
                    document.getElementById(section.toLowerCase())?.scrollIntoView({ behavior: "smooth" })
                  }
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
      {/* Mobile card ⋯ bottom sheet */}
      {mobileCardMenuId && (() => {
        const r = recipes.find((r: any) => r.id === mobileCardMenuId)
        if (!r) return null
        return (
          <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
            <div className="absolute inset-0 bg-black/40" onClick={() => setMobileCardMenuId(null)} />
            <div className="relative bg-white rounded-t-2xl pt-2 pb-8 z-10">
              <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
              <div className="px-4 pb-3 border-b border-gray-100 mb-1">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-0.5">Recipe</p>
                <p className="text-sm font-semibold text-gray-900 truncate">{r.title || "New Recipe"}</p>
              </div>
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-xs text-gray-500 mb-2">Rename</p>
                <div className="flex gap-2">
                  <input
                    value={mobileCardRename}
                    onChange={e => setMobileCardRename(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { const t = mobileCardRename.trim() || "New Recipe"; renameRecipe(mobileCardMenuId, t); setMobileCardMenuId(null) } }}
                    placeholder="Recipe name..."
                    className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-orange-300"
                  />
                  <button
                    onClick={() => { const t = mobileCardRename.trim() || "New Recipe"; renameRecipe(mobileCardMenuId, t); setMobileCardMenuId(null) }}
                    className="px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-semibold active:bg-orange-600">
                    Save
                  </button>
                </div>
              </div>
              <div className="px-2 pt-1">
                <button
                  onClick={() => { deleteRecipe(mobileCardMenuId); setMobileCardMenuId(null) }}
                  className="w-full text-left px-4 py-3.5 text-sm text-red-500 active:bg-red-50 rounded-xl flex items-center gap-3">
                  <TrashIcon size={16} /> Delete recipe
                </button>
              </div>
              <button onClick={() => setMobileCardMenuId(null)} className="w-full mt-2 py-3 text-sm text-gray-400 border-t border-gray-100">
                Cancel
              </button>
            </div>
          </div>
        )
      })()}

      {showMobileActions && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowMobileActions(false)} />
          <div className="relative bg-white rounded-t-2xl pt-2 pb-8 z-10">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
            {recipe && (
              <div className="px-4 pb-3 border-b border-gray-100 mb-1">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Recipe</p>
                <p className="text-sm font-medium text-gray-900 truncate">{recipe.title || "New Recipe"}</p>
              </div>
            )}
            <div className="px-2">
              {recipe && <RecipePDFButton recipe={recipe} className="w-full text-left px-4 py-3.5 text-sm text-gray-700 hover:bg-gray-50 rounded-xl flex items-center gap-3" />}
              {recipe && (
                <button
                  onClick={() => { openCopyModal(); setShowMobileActions(false) }}
                  className="w-full text-left px-4 py-3.5 text-sm text-gray-700 hover:bg-gray-50 rounded-xl flex items-center gap-3">
                  <BookIcon size={16} /> Copy to another cookbook
                </button>
              )}
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

      {showHistory && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end sm:items-center sm:justify-center p-0 sm:p-4 bg-black/40">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-md shadow-xl">
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2"><ClockIcon size={16} />Version History</h2>
              <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {historyLoading ? (
                <div className="py-12 text-center text-sm text-gray-400">Loading...</div>
              ) : historyVersions.length === 0 ? (
                <div className="py-12 text-center text-sm text-gray-400">
                  No saved versions yet.<br/>
                  <span className="text-xs">Versions are saved each time you click Save.</span>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {historyVersions.map((v: any) => (
                    <div key={v.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{v.title || "Untitled"}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{new Date(v.created_at).toLocaleString()} · {v.saved_by}</p>
                      </div>
                      <button
                        onClick={() => restoreVersion(v.id)}
                        className="flex-shrink-0 px-3 py-1.5 bg-orange-50 text-orange-600 text-xs font-medium rounded-lg hover:bg-orange-100 transition">
                        Restore
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="px-5 py-4 border-t border-gray-100">
              <button onClick={() => setShowHistory(false)} className="w-full py-2.5 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50">Close</button>
            </div>
          </div>
        </div>
      )}

      {recipeCropSrc && (
        <ImageCropper
          image={recipeCropSrc}
          aspect={4 / 3}
          onCrop={handleRecipeCrop}
          onCancel={() => setRecipeCropSrc("")}
        />
      )}

      {showCopyModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-5">
            {copyDone ? (
              <div className="text-center py-4">
                <div className="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-3"><CheckIcon size={24} /></div>
                <p className="font-medium text-gray-900">Saved to &ldquo;{copyDone}&rdquo;</p>
                <p className="text-sm text-gray-400 mt-1">Recipe copied to your cookbook</p>
                <button
                  onClick={() => setShowCopyModal(false)}
                  className="mt-5 w-full bg-orange-500 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-orange-600 transition"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-gray-900">Save to my cookbook</h2>
                  <button onClick={() => setShowCopyModal(false)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">✕</button>
                </div>
                {userCookbooks.length === 0 ? (
                  <div className="text-center py-8 text-sm text-gray-400">Loading your cookbooks...</div>
                ) : (
                  <div className="space-y-2 max-h-72 overflow-y-auto">
                    {userCookbooks.map((cb: any) => (
                      <button
                        key={cb.id}
                        onClick={() => copyRecipeToBook(cb.id)}
                        disabled={copyLoading}
                        className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-orange-200 hover:bg-orange-50 transition text-left disabled:opacity-50"
                      >
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-xl overflow-hidden"
                          style={{ backgroundColor: cb.cover_image ? "transparent" : (cb.cover_color || "#F97316") + "22" }}
                        >
                          {cb.cover_image ? <img src={cb.cover_image} className="w-full h-full object-cover" /> : cb.cover_emoji || "📖"}
                        </div>
                        <span className="text-sm font-medium text-gray-800 truncate">{cb.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {cookingMode && recipe && (
        <CookingMode recipes={[recipe]} availableRecipes={recipes} initialScale={scaleFactor} initialStepIndex={resumeStepIndex} onClose={() => { setCookingMode(false); setResumeStepIndex(undefined) }} />
      )}
    </div>
  )
}