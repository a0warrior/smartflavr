"use client"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import Navbar from "../components/Navbar"
import ImageCropper from "../components/ImageCropper"
import Link from "next/link"
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

const COLORS = [
  "#F97316", "#EF4444", "#8B5CF6", "#3B82F6",
  "#10B981", "#F59E0B", "#EC4899", "#6366F1",
  "#14B8A6", "#84CC16"
]

function parseMeasurement(ingredient: string) {
  const skipPhrases = /^(as desired|as needed|to taste|to preference|as preferred)\s*/i
  if (skipPhrases.test(ingredient)) {
    return { measurement: "", rest: ingredient.replace(skipPhrases, "").trim() }
  }
  const match = ingredient.match(/^([\d¼½¾⅓⅔⅛⅜⅝⅞\/\.\s]*\s*(tablespoons?|teaspoons?|cups?|tbsp|tsp|fluid\s*oz|fl\.?\s*oz|ounces?|oz|pounds?|lbs?|lb|grams?|kilograms?|kg|g|milliliters?|ml|liters?|l|cloves?|pieces?|slices?|cans?|packages?|pkg|bunches?|heads?|stalks?|sprigs?|pinches?|dashes?|handfuls?|quarts?|pints?|gallons?|whole)\b\s*)/i)
  if (match && match[0].trim()) {
    return { measurement: match[0].trim(), rest: ingredient.slice(match[0].length).trim() }
  }
  return { measurement: "", rest: ingredient }
}

function SortableGroceryItem({ item, onToggle, onDelete }: any) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  const { measurement, rest } = parseMeasurement(item.ingredient)
  const displayText = measurement ? <><span className="font-semibold">{measurement}</span>{rest ? ` ${rest}` : ""}</> : (rest || item.ingredient)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-gray-50 transition group ${item.checked ? "opacity-50" : ""}`}>
      <span {...attributes} {...listeners} className="text-gray-300 cursor-grab text-sm flex-shrink-0">⠿</span>
      <div
        onClick={() => onToggle(item.id, !item.checked)}
        className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition cursor-pointer ${item.checked ? "bg-orange-500 border-orange-500" : "border-gray-300"}`}>
        {item.checked ? <span className="text-white text-xs">✓</span> : null}
      </div>
      <span
        onClick={() => onToggle(item.id, !item.checked)}
        className={`text-sm flex-1 cursor-pointer ${item.checked ? "line-through text-gray-400" : "text-gray-900"}`}>
        {displayText}
      </span>
      <button onClick={() => onDelete(item.id)} className="text-gray-300 hover:text-red-400 text-xs transition flex-shrink-0">✕</button>
    </div>
  )
}

function LearnPanel() {
  const [learnData, setLearnData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/learn").then(r => r.json()).then(d => { setLearnData(d); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const streak = learnData?.streak || { current_streak: 0, total_xp: 0 }
  const tracks = learnData?.tracks || []
  const completedIds = new Set<number>(learnData?.completedLessonIds || [])
  const activeTrack = tracks.find((t: any) => t.completedCount > 0 && t.completedCount < t.totalCount)
  const nextLesson = activeTrack?.lessons?.find((l: any) => !completedIds.has(l.id))
  const hasStarted = tracks.some((t: any) => t.completedCount > 0)

  if (loading) {
    return (
      <div className="rounded-2xl overflow-hidden border border-gray-100 bg-white animate-pulse" style={{ minHeight: 320 }}>
        <div className="h-32 bg-orange-100"/>
      </div>
    )
  }

  if (!hasStarted) {
    return (
      <div className="rounded-2xl overflow-hidden border border-orange-100 flex flex-col" style={{ position: "relative" }}>
        <div className="bg-orange-500 p-5 relative overflow-hidden">
          <div style={{ position: "absolute", width: 90, height: 90, borderRadius: "50%", background: "#EA6C0A", top: -25, right: -25 }}/>
          <div style={{ position: "absolute", width: 55, height: 55, borderRadius: "50%", background: "#FB923C", bottom: -12, left: 16 }}/>
          <div style={{ position: "absolute", width: 32, height: 32, borderRadius: "50%", background: "#FDBA74", top: 28, right: 28, animation: "float 3s ease-in-out infinite" }}/>
          <style>{`@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}`}</style>
          <div className="text-xs font-medium text-orange-100 uppercase tracking-widest mb-2" style={{ position: "relative" }}>Learn to cook</div>
          <div className="text-white font-medium text-base leading-snug mb-3" style={{ position: "relative" }}>Level up your kitchen skills 🍳</div>
          <div className="flex flex-wrap gap-1.5" style={{ position: "relative" }}>
            {["🔪 Knife skills", "🥚 Eggs", "🍳 Heat", "+ 3 more"].map(p => (
              <span key={p} className="text-xs px-2 py-1 rounded-full text-white" style={{ background: "rgba(255,255,255,0.2)" }}>{p}</span>
            ))}
          </div>
        </div>
        <div className="bg-white p-4">
          <p className="text-xs text-gray-400 mb-3 leading-relaxed">Bite-sized lessons, real techniques, and fun quizzes — like Duolingo for your kitchen.</p>
          <Link href="/learn" className="block w-full bg-orange-500 text-white text-center rounded-xl py-2.5 text-sm font-medium hover:bg-orange-600 transition">
            Start learning →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl overflow-hidden border border-orange-100 flex flex-col">
      <div className="bg-orange-500 p-5 relative overflow-hidden">
        <div style={{ position: "absolute", width: 90, height: 90, borderRadius: "50%", background: "#EA6C0A", top: -25, right: -25 }}/>
        <div style={{ position: "absolute", width: 55, height: 55, borderRadius: "50%", background: "#FB923C", bottom: -12, left: 16 }}/>
        <div style={{ position: "absolute", width: 32, height: 32, borderRadius: "50%", background: "#FDBA74", top: 28, right: 28, animation: "float 3s ease-in-out infinite" }}/>
        <style>{`@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}} @keyframes flicker{0%,100%{transform:scale(1) rotate(-2deg)}50%{transform:scale(1.2) rotate(2deg)}} @keyframes fillbar{from{width:0%}to{width:var(--pct)}} @keyframes btnshine{0%{left:-60%}100%{left:120%}}`}</style>
        <div className="text-xs font-medium text-orange-100 uppercase tracking-widest mb-2" style={{ position: "relative" }}>Learn to cook</div>
        <div className="text-white font-medium text-base leading-snug" style={{ position: "relative" }}>Level up your kitchen skills 🍳</div>
      </div>

      <div className="grid grid-cols-2 bg-orange-50 border-b border-orange-100">
        <div className="p-3 text-center border-r border-orange-100">
          <div className="text-xl font-medium text-orange-500">
            <span style={{ display: "inline-block", animation: "flicker 1.2s ease-in-out infinite" }}>🔥</span> {streak.current_streak}
          </div>
          <div className="text-xs text-orange-400 mt-0.5">Day streak</div>
        </div>
        <div className="p-3 text-center">
          <div className="text-xl font-medium text-orange-500">{streak.total_xp}</div>
          <div className="text-xs text-orange-400 mt-0.5">Total XP ⭐</div>
        </div>
      </div>

      {activeTrack && nextLesson && (
        <div className="bg-white p-4 border-b border-orange-50">
          <div className="flex items-center gap-2.5 mb-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center text-base flex-shrink-0">{activeTrack.emoji}</div>
            <div>
              <div className="text-xs font-medium text-gray-900">{activeTrack.name}</div>
              <div className="text-xs text-orange-400">{activeTrack.completedCount} of {activeTrack.totalCount} lessons done</div>
            </div>
          </div>
          <div className="h-1.5 rounded-full bg-orange-100 overflow-hidden mb-1">
            <div
              className="h-1.5 rounded-full bg-orange-400 transition-all duration-1000"
              style={{ width: `${Math.round((activeTrack.completedCount / activeTrack.totalCount) * 100)}%` }}/>
          </div>
          <div className="flex justify-between mb-3">
            <span className="text-xs text-orange-300">{Math.round((activeTrack.completedCount / activeTrack.totalCount) * 100)}%</span>
            <span className="text-xs text-orange-300">Almost there!</span>
          </div>
          <div className="text-xs text-orange-300 mb-1 uppercase tracking-wide font-medium">Up next</div>
          <div className="text-xs font-medium text-gray-700 mb-3">{nextLesson.title}</div>
          <Link
            href={`/learn/${activeTrack.slug}/${nextLesson.id}`}
            className="block w-full text-center bg-orange-500 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-orange-600 transition overflow-hidden"
            style={{ position: "relative" }}>
            <span style={{ position: "absolute", top: 0, left: "-60%", width: "60%", height: "100%", background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.25),transparent)", animation: "btnshine 2.5s infinite" }}/>
            Continue learning →
          </Link>
        </div>
      )}

      <div className="bg-white p-4">
        <div className="text-xs font-medium text-orange-300 uppercase tracking-wide mb-2.5">All tracks</div>
        <div className="space-y-2">
          {tracks.map((t: any) => {
            const pct = t.totalCount > 0 ? Math.round((t.completedCount / t.totalCount) * 100) : 0
            const done = t.completedCount === t.totalCount && t.totalCount > 0
            return (
              <Link key={t.id} href={`/learn/${t.slug}`} className="flex items-center gap-2 group">
                <span className="text-sm w-5 text-center flex-shrink-0">{t.emoji}</span>
                <div className="flex-1 h-1.5 rounded-full bg-orange-100 overflow-hidden">
                  <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: done ? "#10B981" : "linear-gradient(90deg,#F97316,#FB923C)" }}/>
                </div>
                {done
                  ? <span className="text-xs text-green-500 w-6 text-right">✓</span>
                  : <span className="text-xs text-orange-300 w-6 text-right">{pct}%</span>
                }
              </Link>
            )
          })}
        </div>
        <Link href="/learn" className="block text-center text-xs text-orange-400 hover:text-orange-500 mt-3 transition">
          View all tracks →
        </Link>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [cookbooks, setCookbooks] = useState([])
  const [collaboratedCookbooks, setCollaboratedCookbooks] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingCookbook, setEditingCookbook] = useState<any>(null)
  const [title, setTitle] = useState("")
  const [emoji, setEmoji] = useState("📖")
  const [color, setColor] = useState("#F97316")
  const [coverImage, setCoverImage] = useState("")
  const [loading, setLoading] = useState(false)
  const [url, setUrl] = useState("")
  const [extracting, setExtracting] = useState(false)
  const [extractedRecipe, setExtractedRecipe] = useState<any>(null)
  const [selectedCookbooks, setSelectedCookbooks] = useState<string[]>([])
  const [cropImage, setCropImage] = useState("")
  const [cropTarget, setCropTarget] = useState<"new" | "edit">("new")
  const [showImportModal, setShowImportModal] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importedRecipes, setImportedRecipes] = useState<any[]>([])
  const [importCookbooks, setImportCookbooks] = useState<{[key: number]: string[]}>({})
  const [groceryLists, setGroceryLists] = useState<any[]>([])
  const [showGroceryListModal, setShowGroceryListModal] = useState(false)
  const [activeGroceryList, setActiveGroceryList] = useState<any>(null)
  const [showNewGroceryModal, setShowNewGroceryModal] = useState(false)
  const [newListName, setNewListName] = useState("")
  const [newListItem, setNewListItem] = useState("")
  const [newListItems, setNewListItems] = useState<string[]>([])
  const [savingNewList, setSavingNewList] = useState(false)
  const [editItemInput, setEditItemInput] = useState("")
  const [showDeleteCookbookModal, setShowDeleteCookbookModal] = useState(false)
  const [cookbookToDelete, setCookbookToDelete] = useState<string | null>(null)
  const [isPublic, setIsPublic] = useState(0)
  const [showDeleteGroceryModal, setShowDeleteGroceryModal] = useState(false)
  const [groceryListToDelete, setGroceryListToDelete] = useState<number | null>(null)
  const [editingListName, setEditingListName] = useState(false)
  const [listNameInput, setListNameInput] = useState("")

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login?code=returning")
    if (status === "authenticated") registerUser()
  }, [status])

  async function registerUser() {
    const urlParams = new URLSearchParams(window.location.search)
    let code = urlParams.get("code")
    if (!code) code = localStorage.getItem("pendingInviteCode")
    if (code && code !== "" && code !== "returning") {
      await fetch("/api/invite", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, email: session?.user?.email, name: session?.user?.name, image: session?.user?.image }),
      })
      localStorage.removeItem("pendingInviteCode")
      router.push("/profile/settings?new=true")
      return
    }
    const res = await fetch("/api/profile")
    const data = await res.json()
    if (!data.user?.username) { router.push("/profile/settings?new=true"); return }
    fetchCookbooks()
    fetchGroceryLists()
  }

  async function fetchCookbooks() {
    const res = await fetch("/api/cookbooks")
    const data = await res.json()
    setCookbooks(data.cookbooks || [])
    setCollaboratedCookbooks(data.collaborated || [])
  }

  async function fetchGroceryLists() {
    const res = await fetch("/api/grocery-lists")
    const data = await res.json()
    setGroceryLists(data.lists || [])
  }

  async function refreshActiveList(listId: number) {
    const res = await fetch("/api/grocery-lists")
    const data = await res.json()
    const lists = data.lists || []
    setGroceryLists(lists)
    const fresh = lists.find((l: any) => l.id === listId)
    if (fresh) setActiveGroceryList(fresh)
  }

  async function toggleGroceryItem(itemId: number, checked: boolean) {
    await fetch("/api/grocery-lists/check", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: itemId, checked }),
    })
    setActiveGroceryList((prev: any) => ({ ...prev, items: prev.items.map((item: any) => item.id === itemId ? { ...item, checked: checked ? 1 : 0 } : item) }))
    setGroceryLists(prev => prev.map((list: any) => list.id === activeGroceryList?.id ? { ...list, items: list.items.map((item: any) => item.id === itemId ? { ...item, checked: checked ? 1 : 0 } : item) } : list))
  }

  async function deleteGroceryItem(itemId: number) {
    await fetch("/api/grocery-lists", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: activeGroceryList.id, deleteItemIds: [itemId] }) })
    const updated = { ...activeGroceryList, items: activeGroceryList.items.filter((i: any) => i.id !== itemId) }
    setActiveGroceryList(updated)
    setGroceryLists(prev => prev.map((l: any) => l.id === updated.id ? updated : l))
  }

  async function addItemToList() {
    if (!editItemInput.trim()) return
    await fetch("/api/grocery-lists", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: activeGroceryList.id, addItems: [editItemInput.trim()] }) })
    setEditItemInput("")
    await refreshActiveList(activeGroceryList.id)
  }

  async function handleGroceryDragEnd(event: any) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const items = activeGroceryList.items
    const oldIndex = items.findIndex((i: any) => i.id === active.id)
    const newIndex = items.findIndex((i: any) => i.id === over.id)
    const newOrder = arrayMove(items, oldIndex, newIndex)
    const updated = { ...activeGroceryList, items: newOrder }
    setActiveGroceryList(updated)
    setGroceryLists(prev => prev.map((l: any) => l.id === updated.id ? updated : l))
    await fetch("/api/grocery-lists", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: activeGroceryList.id, reorderItems: newOrder.map((item: any, index: number) => ({ id: item.id, sort_order: index })) }) })
  }

  async function deleteGroceryList(id: number) { setGroceryListToDelete(id); setShowDeleteGroceryModal(true) }

  async function confirmDeleteGroceryList() {
    if (!groceryListToDelete) return
    await fetch("/api/grocery-lists", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: groceryListToDelete }) })
    setGroceryLists(prev => prev.filter((l: any) => l.id !== groceryListToDelete))
    if (activeGroceryList?.id === groceryListToDelete) { setShowGroceryListModal(false); setActiveGroceryList(null) }
    setShowDeleteGroceryModal(false)
    setGroceryListToDelete(null)
  }

  async function createNewGroceryList() {
    if (!newListName.trim()) return
    setSavingNewList(true)
    await fetch("/api/grocery-lists", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newListName.trim(), items: newListItems }) })
    await fetchGroceryLists()
    setShowNewGroceryModal(false); setNewListName(""); setNewListItems([]); setNewListItem(""); setSavingNewList(false)
  }

  function addItemToNewList() {
    if (!newListItem.trim()) return
    setNewListItems(prev => [...prev, newListItem.trim()])
    setNewListItem("")
  }

  async function uploadCoverImage(e: React.ChangeEvent<HTMLInputElement>, isEdit = false) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => { setCropImage(reader.result as string); setCropTarget(isEdit ? "edit" : "new") }
    reader.readAsDataURL(file)
  }

  async function handleCropDone(cropped: string) {
    const res = await fetch("/api/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: cropped }) })
    const data = await res.json()
    if (data.success) { cropTarget === "edit" ? setEditingCookbook((prev: any) => ({ ...prev, cover_image: data.url })) : setCoverImage(data.url) }
    setCropImage("")
  }

  async function createCookbook() {
    if (!title) return
    setLoading(true)
    await fetch("/api/cookbooks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, cover_emoji: emoji, cover_color: color, cover_image: coverImage, is_public: isPublic }) })
    setTitle(""); setEmoji("📖"); setColor("#F97316"); setCoverImage(""); setIsPublic(0); setShowModal(false); setLoading(false)
    fetchCookbooks()
  }

  async function updateCookbook() {
    if (!editingCookbook) return
    setLoading(true)
    await fetch(`/api/cookbooks/${editingCookbook.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: editingCookbook.title, cover_emoji: editingCookbook.cover_emoji, cover_color: editingCookbook.cover_color, cover_image: editingCookbook.cover_image || "", is_public: editingCookbook.is_public ?? 0 }) })
    setShowEditModal(false); setEditingCookbook(null); setLoading(false)
    fetchCookbooks()
  }

  async function deleteCookbook(id: string) { setCookbookToDelete(id); setShowDeleteCookbookModal(true) }

  async function confirmDeleteCookbook() {
    if (!cookbookToDelete) return
    await fetch(`/api/cookbooks/${cookbookToDelete}`, { method: "DELETE" })
    setShowDeleteCookbookModal(false); setCookbookToDelete(null); setShowEditModal(false); setEditingCookbook(null)
    fetchCookbooks()
  }

  async function extractRecipe() {
    if (!url) return
    setExtracting(true)
    const res = await fetch("/api/extract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) })
    const data = await res.json()
    if (data.success) { setExtractedRecipe(data.recipe); setUrl("") } else { alert("Could not extract recipe. Try a different URL.") }
    setExtracting(false)
  }

  async function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true); setShowImportModal(true); setImportedRecipes([]); setImportCookbooks({})
    if (file.type.startsWith("image/") || file.type === "application/pdf") {
      const reader = new FileReader()
      reader.onloadend = async () => {
        const res = await fetch("/api/extract-file", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: reader.result, type: "image" }) })
        const data = await res.json()
        if (data.success) setImportedRecipes(data.recipes); else alert("Could not extract recipe.")
        setImporting(false)
      }
      reader.readAsDataURL(file)
    } else {
      const text = await file.text()
      const res = await fetch("/api/extract-file", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, type: "text" }) })
      const data = await res.json()
      if (data.success) setImportedRecipes(data.recipes); else alert("Could not extract recipe.")
      setImporting(false)
    }
  }

  function toggleImportCookbook(recipeIndex: number, cookbookId: string) {
    setImportCookbooks(prev => { const current = prev[recipeIndex] || []; return { ...prev, [recipeIndex]: current.includes(cookbookId) ? current.filter(id => id !== cookbookId) : [...current, cookbookId] } })
  }

  async function saveImportedRecipes() {
    if (importedRecipes.length === 0) return
    let saved = 0
    for (let i = 0; i < importedRecipes.length; i++) {
      for (const cookbookId of (importCookbooks[i] || [])) {
        await fetch("/api/recipes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...importedRecipes[i], cookbook_id: cookbookId }) })
        saved++
      }
    }
    setShowImportModal(false); setImportedRecipes([]); setImportCookbooks({})
    alert(`Saved ${saved} recipe${saved !== 1 ? "s" : ""}!`)
  }

  async function saveRecipe() {
    if (selectedCookbooks.length === 0 || !extractedRecipe) return
    for (const cookbookId of selectedCookbooks) {
      await fetch("/api/recipes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...extractedRecipe, cookbook_id: cookbookId }) })
    }
    setExtractedRecipe(null); setSelectedCookbooks([])
    alert(`Recipe saved to ${selectedCookbooks.length} cookbook${selectedCookbooks.length > 1 ? "s" : ""}!`)
  }

  function toggleCookbook(id: string) {
    setSelectedCookbooks(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])
  }

  if (status === "loading") return <div className="min-h-screen flex items-center justify-center">Loading...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      {/* Learn panel — lives outside the scrollable container, fixed to viewport */}
      <div className="fixed top-16 right-0 w-72 overflow-y-auto px-4 pt-6 pb-10 bg-gray-50 border-l border-gray-100" style={{ zIndex: 10, height: "calc(100vh - 64px)" }}>
        <LearnPanel />
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10 mr-72">

        <div className="mb-8">
          <h2 className="text-lg font-medium text-gray-900 mb-1">Import a Recipe</h2>
          <p className="text-sm text-gray-400 mb-4">SmartFlavr can read recipes from the web or your files and save them straight to your cookbooks.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-gray-100 rounded-2xl p-5">
              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-lg mb-3">🔗</div>
              <h3 className="text-sm font-medium text-gray-900 mb-1">Extract from URL</h3>
              <p className="text-xs text-gray-400 mb-4 leading-relaxed">Paste a link from any recipe site and we'll pull out the ingredients, steps, and details automatically.</p>
              <div className="flex gap-2 mb-3">
                <input value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === "Enter" && extractRecipe()} placeholder="https://allrecipes.com/recipe/..." className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none bg-gray-50"/>
                <button onClick={extractRecipe} disabled={extracting} className="bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-orange-600 transition whitespace-nowrap">{extracting ? "Extracting..." : "Extract"}</button>
              </div>
              <p className="text-xs text-gray-400 mb-2">Works with</p>
              <div className="flex flex-wrap gap-1.5">
                {["AllRecipes", "Pinterest", "Food Network", "Tasty", "NYT Cooking", "+ most recipe sites"].map(s => (
                  <span key={s} className="text-xs px-2.5 py-1 rounded-full border border-gray-100 text-gray-400 bg-gray-50">{s}</span>
                ))}
              </div>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-5">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-lg mb-3">📄</div>
              <h3 className="text-sm font-medium text-gray-900 mb-1">Import from file</h3>
              <p className="text-xs text-gray-400 mb-4 leading-relaxed">Upload a photo of a recipe card, a PDF cookbook page, or a text file — AI will do the reading.</p>
              <p className="text-xs text-gray-400 mb-2">Supported formats</p>
              <div className="flex flex-wrap gap-1.5 mb-4">
                <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">📷 Photo</span>
                <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">📄 PDF</span>
                <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">📝 Text file</span>
              </div>
              <button onClick={() => document.getElementById("file-import")?.click()} className="w-full border border-gray-200 text-gray-600 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition text-center">Choose a file to import</button>
              <input type="file" id="file-import" accept="image/*,.pdf,.txt" onChange={handleFileImport} className="hidden"/>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-medium text-gray-900">My Cookbooks</h1>
            <p className="text-gray-500 text-sm mt-1">Welcome back, {session?.user?.name?.split(" ")[0]}!</p>
          </div>
          <button onClick={() => setShowModal(true)} className="bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-orange-600 transition">+ New Cookbook</button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-10">
          {cookbooks.map((book: any) => (
            <div key={book.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden cursor-pointer hover:shadow-sm transition group relative">
              <div onClick={() => router.push(`/cookbook/${book.id}`)} className="h-24 flex items-center justify-center overflow-hidden" style={{ backgroundColor: book.cover_image ? "transparent" : book.cover_color + "22" }}>
                {book.cover_image ? <img src={book.cover_image} className="w-full h-full object-cover"/> : <span className="text-4xl">{book.cover_emoji}</span>}
              </div>
              <div className="p-3 flex items-center justify-between">
                <div onClick={() => router.push(`/cookbook/${book.id}`)} className="font-medium text-sm text-gray-900 flex-1 truncate">{book.title}</div>
                <div className="flex items-center gap-1">
                  {book.is_public === 1 && <span className="text-xs text-green-500 font-medium">Public</span>}
                  <button onClick={e => { e.stopPropagation(); setEditingCookbook({ ...book }); setShowEditModal(true) }} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 text-xs px-2 transition">✏️</button>
                </div>
              </div>
            </div>
          ))}
          <div onClick={() => setShowModal(true)} className="bg-white border border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center p-8 cursor-pointer hover:bg-gray-50 transition">
            <span className="text-3xl text-gray-300 mb-2">+</span>
            <span className="text-sm text-gray-400">New cookbook</span>
          </div>
        </div>

        {collaboratedCookbooks.length > 0 && (
          <div className="mb-10">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Shared with me</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {collaboratedCookbooks.map((book: any) => (
                <div key={book.id} onClick={() => router.push(`/cookbook/${book.id}`)} className="bg-white border border-gray-100 rounded-2xl overflow-hidden cursor-pointer hover:shadow-sm transition">
                  <div className="h-24 flex items-center justify-center overflow-hidden" style={{ backgroundColor: book.cover_image ? "transparent" : book.cover_color + "22" }}>
                    {book.cover_image ? <img src={book.cover_image} className="w-full h-full object-cover"/> : <span className="text-4xl">{book.cover_emoji}</span>}
                  </div>
                  <div className="p-3">
                    <div className="font-medium text-sm text-gray-900 truncate">{book.title}</div>
                    <div className="flex items-center gap-1 mt-1">
                      {book.owner_image ? <img src={book.owner_image} className="w-4 h-4 rounded-full object-cover"/> : <div className="w-4 h-4 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs">{book.owner_name?.charAt(0)}</div>}
                      <span className="text-xs text-gray-400">{book.owner_name}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900">My Grocery Lists</h2>
            <button onClick={() => { setShowNewGroceryModal(true); setNewListName(""); setNewListItems([]); setNewListItem("") }} className="bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-orange-600 transition">+ New List</button>
          </div>
          {groceryLists.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center p-10 text-center">
              <span className="text-3xl mb-2">🛒</span>
              <p className="text-sm text-gray-400">No grocery lists yet</p>
              <p className="text-xs text-gray-300 mt-1">Create one manually or generate from your meal plan</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {groceryLists.map((list: any) => {
                const total = list.items?.length || 0
                const checkedCount = list.items?.filter((i: any) => i.checked).length || 0
                const pct = total > 0 ? Math.round((checkedCount / total) * 100) : 0
                return (
                  <div key={list.id} className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center justify-between gap-4 hover:shadow-sm transition">
                    <div className="flex-1 cursor-pointer min-w-0" onClick={() => { setActiveGroceryList(list); setShowGroceryListModal(true) }}>
                      <div className="font-medium text-sm text-gray-900 truncate">🛒 {list.name}</div>
                      <div className="text-xs text-gray-400 mt-1">{total} items · {pct}% done</div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
                        <div className="bg-orange-400 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }}/>
                      </div>
                    </div>
                    <button onClick={() => deleteGroceryList(list.id)} className="text-xs text-red-400 hover:text-red-600 border border-red-100 hover:border-red-300 rounded-lg px-3 py-1.5 transition flex-shrink-0">Delete</button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>

      {showGroceryListModal && activeGroceryList && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-1">
              {editingListName ? (
                <input value={listNameInput} onChange={e => setListNameInput(e.target.value)}
                  onBlur={async () => {
                    if (listNameInput.trim() && listNameInput !== activeGroceryList.name) {
                      await fetch("/api/grocery-lists", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: activeGroceryList.id, name: listNameInput.trim() }) })
                      setActiveGroceryList((prev: any) => ({ ...prev, name: listNameInput.trim() }))
                      setGroceryLists(prev => prev.map((l: any) => l.id === activeGroceryList.id ? { ...l, name: listNameInput.trim() } : l))
                    }
                    setEditingListName(false)
                  }}
                  onKeyDown={e => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                  autoFocus className="text-lg font-medium border-b border-orange-300 outline-none flex-1 mr-2"/>
              ) : (
                <h2 onClick={() => { setListNameInput(activeGroceryList.name); setEditingListName(true) }} className="text-lg font-medium cursor-pointer hover:text-orange-500 transition flex-1 mr-2" title="Click to rename">
                  {activeGroceryList.name} ✏️
                </h2>
              )}
              <button onClick={() => deleteGroceryList(activeGroceryList.id)} className="text-xs text-red-400 hover:text-red-600 border border-red-100 hover:border-red-300 rounded-lg px-3 py-1.5 transition">Delete list</button>
            </div>
            <p className="text-xs text-gray-400 mb-3">{activeGroceryList.items?.filter((i: any) => i.checked).length} of {activeGroceryList.items?.length} items checked</p>
            <div className="flex gap-2 mb-4">
              <a href="https://www.hy-vee.com/aisles-online/" target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-2 py-2 bg-red-50 hover:bg-red-100 border border-red-100 rounded-xl transition">
                <span className="text-base">🛒</span><span className="text-xs font-medium text-red-700">Hy-Vee</span>
              </a>
              <a href="https://www.walmart.com" target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-2 py-2 bg-blue-50 hover:bg-blue-100 border border-blue-100 rounded-xl transition">
                <span className="text-base">🛍️</span><span className="text-xs font-medium text-blue-700">Walmart</span>
              </a>
              <a href="https://shop.fareway.com" target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-2 py-2 bg-green-50 hover:bg-green-100 border border-green-100 rounded-xl transition">
                <span className="text-base">🥩</span><span className="text-xs font-medium text-green-700">Fareway</span>
              </a>
            </div>
            <div className="flex gap-2 mb-4">
              <input value={editItemInput} onChange={e => setEditItemInput(e.target.value)} onKeyDown={e => e.key === "Enter" && addItemToList()} placeholder="Add an item..." className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none"/>
              <button onClick={addItemToList} className="px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600">Add</button>
            </div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleGroceryDragEnd}>
              <SortableContext items={activeGroceryList.items?.map((i: any) => i.id) || []} strategy={verticalListSortingStrategy}>
                <div className="space-y-0.5 mb-6">
                  {activeGroceryList.items?.map((item: any) => (
                    <SortableGroceryItem key={item.id} item={item} onToggle={toggleGroceryItem} onDelete={deleteGroceryItem}/>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            <button onClick={() => { setShowGroceryListModal(false); setActiveGroceryList(null); setEditItemInput("") }} className="w-full border border-gray-200 rounded-xl py-2 text-sm text-gray-500 hover:bg-gray-50">Done</button>
          </div>
        </div>
      )}

      {showNewGroceryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 max-h-[85vh] overflow-y-auto">
            <h2 className="text-lg font-medium mb-4">New Grocery List</h2>
            <div className="mb-4">
              <label className="text-sm text-gray-500 mb-1 block">List name</label>
              <input value={newListName} onChange={e => setNewListName(e.target.value)} placeholder="e.g. Weekly Shop" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none"/>
            </div>
            <div className="mb-4">
              <label className="text-sm text-gray-500 mb-1 block">Add items</label>
              <div className="flex gap-2">
                <input value={newListItem} onChange={e => setNewListItem(e.target.value)} onKeyDown={e => e.key === "Enter" && addItemToNewList()} placeholder="e.g. 2 cups chicken broth" className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none"/>
                <button onClick={addItemToNewList} className="px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-medium hover:bg-orange-600">Add</button>
              </div>
            </div>
            {newListItems.length > 0 && (
              <div className="mb-6 space-y-1">
                {newListItems.map((item, i) => {
                  const { measurement, rest } = parseMeasurement(item)
                  return (
                    <div key={i} className="flex items-center gap-3 py-2 px-3 bg-gray-50 rounded-xl group">
                      <span className="text-sm flex-1 text-gray-700">{measurement ? <><span className="font-semibold">{measurement}</span>{rest ? ` ${rest}` : ""}</> : item}</span>
                      <button onClick={() => setNewListItems(prev => prev.filter((_, idx) => idx !== i))} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 text-xs transition">✕</button>
                    </div>
                  )
                })}
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => setShowNewGroceryModal(false)} className="flex-1 border border-gray-200 rounded-xl py-2 text-sm text-gray-500 hover:bg-gray-50">Cancel</button>
              <button onClick={createNewGroceryList} disabled={savingNewList || !newListName.trim()} className="flex-1 bg-orange-500 text-white rounded-xl py-2 text-sm font-medium hover:bg-orange-600 disabled:opacity-50">{savingNewList ? "Creating..." : "Create List"}</button>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4">
            <h2 className="text-lg font-medium mb-4">New Cookbook</h2>
            <div className="mb-4">
              <label className="text-sm text-gray-500 mb-1 block">Title</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Italian Classics" className="border border-gray-200 rounded-lg px-3 py-2 w-full text-sm"/>
            </div>
            <div className="mb-4">
              <label className="text-sm text-gray-500 mb-1 block">Cover image (optional)</label>
              <div onClick={() => document.getElementById("cover-upload-new")?.click()} className="border-2 border-dashed border-gray-100 rounded-xl h-24 flex items-center justify-center cursor-pointer hover:bg-gray-50 overflow-hidden">
                {coverImage ? <img src={coverImage} className="w-full h-full object-cover rounded-xl"/> : <span className="text-xs text-gray-400">📷 Click to add cover photo</span>}
              </div>
              <input type="file" id="cover-upload-new" accept="image/*" onChange={e => uploadCoverImage(e, false)} className="hidden"/>
              {coverImage && <button onClick={() => setCoverImage("")} className="text-xs text-red-400 mt-1">Remove image</button>}
            </div>
            {!coverImage && (
              <>
                <div className="mb-4">
                  <label className="text-sm text-gray-500 mb-1 block">Emoji (shown if no image)</label>
                  <input value={emoji} onChange={e => setEmoji(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 w-20 text-center text-2xl"/>
                </div>
                <div className="mb-4">
                  <label className="text-sm text-gray-500 mb-2 block">Cover color</label>
                  <div className="flex gap-2 flex-wrap">
                    {COLORS.map(c => <div key={c} onClick={() => setColor(c)} className="w-7 h-7 rounded-full cursor-pointer" style={{ backgroundColor: c, outline: color === c ? `3px solid ${c}` : "none", outlineOffset: "2px" }}/>)}
                  </div>
                </div>
              </>
            )}
            <div className="mb-6">
              <label className="text-sm text-gray-500 mb-2 block">Visibility</label>
              <div className="flex gap-3">
                <button onClick={() => setIsPublic(0)} className={`flex-1 py-2 rounded-xl text-sm border transition ${isPublic === 0 ? "bg-gray-900 text-white border-gray-900" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}>🔒 Private</button>
                <button onClick={() => setIsPublic(1)} className={`flex-1 py-2 rounded-xl text-sm border transition ${isPublic === 1 ? "bg-green-500 text-white border-green-500" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}>🌍 Public</button>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowModal(false); setIsPublic(0) }} className="flex-1 border border-gray-200 rounded-xl py-2 text-sm text-gray-500 hover:bg-gray-50">Cancel</button>
              <button onClick={createCookbook} disabled={loading} className="flex-1 bg-orange-500 text-white rounded-xl py-2 text-sm font-medium hover:bg-orange-600">{loading ? "Creating..." : "Create"}</button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && editingCookbook && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-medium mb-4">Edit Cookbook</h2>
            <div className="mb-4">
              <label className="text-sm text-gray-500 mb-1 block">Title</label>
              <input value={editingCookbook.title} onChange={e => setEditingCookbook({ ...editingCookbook, title: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-2 w-full text-sm"/>
            </div>
            <div className="mb-4">
              <label className="text-sm text-gray-500 mb-1 block">Cover image (optional)</label>
              <div onClick={() => document.getElementById("cover-upload-edit")?.click()} className="border-2 border-dashed border-gray-100 rounded-xl h-24 flex items-center justify-center cursor-pointer hover:bg-gray-50 overflow-hidden">
                {editingCookbook.cover_image ? <img src={editingCookbook.cover_image} className="w-full h-full object-cover rounded-xl"/> : <span className="text-xs text-gray-400">📷 Click to add cover photo</span>}
              </div>
              <input type="file" id="cover-upload-edit" accept="image/*" onChange={e => uploadCoverImage(e, true)} className="hidden"/>
              {editingCookbook.cover_image && <button onClick={() => setEditingCookbook({ ...editingCookbook, cover_image: "" })} className="text-xs text-red-400 mt-1">Remove image</button>}
            </div>
            {!editingCookbook.cover_image && (
              <>
                <div className="mb-4">
                  <label className="text-sm text-gray-500 mb-1 block">Emoji</label>
                  <input value={editingCookbook.cover_emoji} onChange={e => setEditingCookbook({ ...editingCookbook, cover_emoji: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-2 w-20 text-center text-2xl"/>
                </div>
                <div className="mb-4">
                  <label className="text-sm text-gray-500 mb-2 block">Cover color</label>
                  <div className="flex gap-2 flex-wrap">
                    {COLORS.map(c => <div key={c} onClick={() => setEditingCookbook({ ...editingCookbook, cover_color: c })} className="w-7 h-7 rounded-full cursor-pointer" style={{ backgroundColor: c, outline: editingCookbook.cover_color === c ? `3px solid ${c}` : "none", outlineOffset: "2px" }}/>)}
                  </div>
                </div>
              </>
            )}
            <div className="mb-6">
              <label className="text-sm text-gray-500 mb-2 block">Visibility</label>
              <div className="flex gap-3">
                <button onClick={() => setEditingCookbook({ ...editingCookbook, is_public: 0 })} className={`flex-1 py-2 rounded-xl text-sm border transition ${editingCookbook.is_public === 0 || !editingCookbook.is_public ? "bg-gray-900 text-white border-gray-900" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}>🔒 Private</button>
                <button onClick={() => setEditingCookbook({ ...editingCookbook, is_public: 1 })} className={`flex-1 py-2 rounded-xl text-sm border transition ${editingCookbook.is_public === 1 ? "bg-green-500 text-white border-green-500" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}>🌍 Public</button>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => deleteCookbook(editingCookbook.id)} className="px-4 py-2 border border-red-200 text-red-400 rounded-xl text-sm hover:bg-red-50">Delete</button>
              <button onClick={() => setShowEditModal(false)} className="flex-1 border border-gray-200 rounded-xl py-2 text-sm text-gray-500 hover:bg-gray-50">Cancel</button>
              <button onClick={updateCookbook} disabled={loading} className="flex-1 bg-orange-500 text-white rounded-xl py-2 text-sm font-medium hover:bg-orange-600">{loading ? "Saving..." : "Save"}</button>
            </div>
          </div>
        </div>
      )}

      {extractedRecipe && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 max-h-[80vh] overflow-y-auto">
            <h2 className="text-lg font-medium mb-1">{extractedRecipe.title}</h2>
            <p className="text-sm text-gray-500 mb-4">{extractedRecipe.description}</p>
            <div className="mb-3">
              <p className="text-xs font-medium text-gray-400 uppercase mb-1">Ingredients</p>
              <p className="text-sm text-gray-700 whitespace-pre-line">{extractedRecipe.ingredients}</p>
            </div>
            <div className="mb-4">
              <p className="text-xs font-medium text-gray-400 uppercase mb-1">Instructions</p>
              <p className="text-sm text-gray-700 whitespace-pre-line">{extractedRecipe.instructions}</p>
            </div>
            <div className="mb-6">
              <p className="text-sm text-gray-500 mb-2">Save to cookbook(s)</p>
              <div className="space-y-2">
                {cookbooks.map((book: any) => (
                  <label key={book.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 cursor-pointer">
                    <input type="checkbox" checked={selectedCookbooks.includes(book.id)} onChange={() => toggleCookbook(book.id)} className="w-4 h-4 accent-orange-500"/>
                    <span className="text-sm">{book.cover_emoji} {book.title}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setExtractedRecipe(null); setSelectedCookbooks([]) }} className="flex-1 border border-gray-200 rounded-xl py-2 text-sm text-gray-500 hover:bg-gray-50">Discard</button>
              <button onClick={saveRecipe} disabled={selectedCookbooks.length === 0} className="flex-1 bg-orange-500 text-white rounded-xl py-2 text-sm font-medium hover:bg-orange-600 disabled:opacity-50">
                Save to {selectedCookbooks.length > 0 ? `${selectedCookbooks.length} cookbook${selectedCookbooks.length > 1 ? "s" : ""}` : "cookbook"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-medium mb-4">Import Recipes</h2>
            {importing ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-3">🤖</div>
                <p className="text-sm text-gray-500">AI is reading your file...</p>
                <p className="text-xs text-gray-400 mt-1">This may take a few seconds</p>
              </div>
            ) : importedRecipes.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-gray-500">No recipes found</p>
                <button onClick={() => setShowImportModal(false)} className="mt-4 border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-500 hover:bg-gray-50">Close</button>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-500 mb-4">Found {importedRecipes.length} recipe{importedRecipes.length > 1 ? "s" : ""}! Select which cookbooks to save each to.</p>
                <div className="space-y-4 mb-4">
                  {importedRecipes.map((r, i) => (
                    <div key={i} className="bg-gray-50 rounded-xl p-3">
                      <div className="font-medium text-sm mb-1">{r.title}</div>
                      {r.description && <div className="text-xs text-gray-500 mb-2 line-clamp-2">{r.description}</div>}
                      <div className="flex gap-3 mb-3 text-xs text-gray-400">
                        {r.prep_time && <span>⏱ {r.prep_time}</span>}
                        {r.servings && <span>👤 {r.servings}</span>}
                        {r.difficulty && <span>★ {r.difficulty}</span>}
                      </div>
                      <p className="text-xs text-gray-500 mb-2">Save to:</p>
                      <div className="space-y-1">
                        {cookbooks.map((book: any) => (
                          <label key={book.id} className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white cursor-pointer">
                            <input type="checkbox" checked={(importCookbooks[i] || []).includes(book.id)} onChange={() => toggleImportCookbook(i, book.id)} className="w-3.5 h-3.5 accent-orange-500"/>
                            <span className="text-xs">{book.cover_emoji} {book.title}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => { setShowImportModal(false); setImportedRecipes([]); setImportCookbooks({}) }} className="flex-1 border border-gray-200 rounded-xl py-2 text-sm text-gray-500 hover:bg-gray-50">Cancel</button>
                  <button onClick={saveImportedRecipes} disabled={Object.values(importCookbooks).every(v => v.length === 0)} className="flex-1 bg-orange-500 text-white rounded-xl py-2 text-sm font-medium hover:bg-orange-600 disabled:opacity-50">
                    Save {Object.values(importCookbooks).flat().length} to cookbook{Object.values(importCookbooks).flat().length !== 1 ? "s" : ""}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showDeleteGroceryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4">
            <h2 className="text-lg font-medium mb-2">Delete Grocery List?</h2>
            <p className="text-sm text-gray-500 mb-6">This will permanently delete the list and all its items. This can't be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => { setShowDeleteGroceryModal(false); setGroceryListToDelete(null) }} className="flex-1 border border-gray-200 rounded-xl py-2 text-sm text-gray-500 hover:bg-gray-50">Cancel</button>
              <button onClick={confirmDeleteGroceryList} className="flex-1 bg-red-500 text-white rounded-xl py-2 text-sm font-medium hover:bg-red-600">Delete</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteCookbookModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4">
            <h2 className="text-lg font-medium mb-2">Delete Cookbook?</h2>
            <p className="text-sm text-gray-500 mb-6">This will permanently delete the cookbook and all its recipes. This can't be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => { setShowDeleteCookbookModal(false); setCookbookToDelete(null) }} className="flex-1 border border-gray-200 rounded-xl py-2 text-sm text-gray-500 hover:bg-gray-50">Cancel</button>
              <button onClick={confirmDeleteCookbook} className="flex-1 bg-red-500 text-white rounded-xl py-2 text-sm font-medium hover:bg-red-600">Delete</button>
            </div>
          </div>
        </div>
      )}

      {cropImage && <ImageCropper image={cropImage} aspect={16 / 9} onCrop={handleCropDone} onCancel={() => setCropImage("")}/>}
    </div>
  )
}