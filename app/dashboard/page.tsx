"use client"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import Navbar from "../components/Navbar"
import GroceryCollaboratorModal from "../components/GroceryCollaboratorModal"
import { toast } from "../components/Toast"
import { PageSkeleton } from "../components/Skeletons"
import { useExtraction } from "../components/ExtractionProvider"
import { escapeHtml } from "@/lib/sanitize"
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
import { ClockIcon, UserIcon, StarIcon, LinkIcon, DocumentIcon, CameraIcon, PrintIcon, ListIcon, CheckIcon, PencilIcon, GlobeIcon, LockIcon, SparkleIcon, PinIcon, SearchIcon } from "@/app/components/Icons"
import { pulse, subscribe } from "@/lib/firebase"

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

function SortableGroceryItem({ item, onToggle, onDelete, onHousehold }: any) {
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
      {onHousehold && (
        <button onClick={() => onHousehold(item)} title="Move to Household" className="opacity-100 md:opacity-0 md:group-hover:opacity-100 text-gray-300 hover:text-blue-400 transition flex-shrink-0 p-1 -m-1">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
        </button>
      )}
      <button onClick={() => onDelete(item.id)} className="text-gray-300 hover:text-red-400 text-xs transition flex-shrink-0 p-1 -m-1">✕</button>
    </div>
  )
}

// Household (non-food) rows — same look, no drag ordering
function HouseholdGroceryItem({ item, onToggle, onDelete, onHousehold }: any) {
  return (
    <div className={`flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-gray-50 transition group ${item.checked ? "opacity-50" : ""}`}>
      <span className="w-4 flex-shrink-0" />
      <div
        onClick={() => onToggle(item.id, !item.checked)}
        className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition cursor-pointer ${item.checked ? "bg-blue-500 border-blue-500" : "border-gray-300"}`}>
        {item.checked ? <span className="text-white text-xs">✓</span> : null}
      </div>
      <span
        onClick={() => onToggle(item.id, !item.checked)}
        className={`text-sm flex-1 cursor-pointer ${item.checked ? "line-through text-gray-400" : "text-gray-900"}`}>
        {item.ingredient}
      </span>
      <button onClick={() => onHousehold(item)} title="Move back to Food" className="opacity-100 md:opacity-0 md:group-hover:opacity-100 text-gray-300 hover:text-orange-400 transition flex-shrink-0 p-1 -m-1">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/></svg>
      </button>
      <button onClick={() => onDelete(item.id)} className="text-gray-300 hover:text-red-400 text-xs transition flex-shrink-0 p-1 -m-1">✕</button>
    </div>
  )
}

export default function Dashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [cookbooks, setCookbooks] = useState<any[]>([])
  const [collaboratedCookbooks, setCollaboratedCookbooks] = useState<any[]>([])
  const [showModal, setShowModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingCookbook, setEditingCookbook] = useState<any>(null)
  const [title, setTitle] = useState("")
  const [emoji, setEmoji] = useState("📖")
  const [color, setColor] = useState("#F97316")
  const [coverImage, setCoverImage] = useState("")
  const [loading, setLoading] = useState(false)
  const [url, setUrl] = useState("")
  const {
    extracting, extractedRecipe, clearExtractedRecipe, startUrlExtraction,
    importing, showImportModal, importedRecipes, setImportedRecipes, closeImportModal, startFileImport,
  } = useExtraction()
  const [selectedCookbooks, setSelectedCookbooks] = useState<string[]>([])
  const [cropImage, setCropImage] = useState("")
  const [cropTarget, setCropTarget] = useState<"new" | "edit">("new")
  const [importCookbooks, setImportCookbooks] = useState<{[key: number]: string[]}>({})
  const [expandedImports, setExpandedImports] = useState<Set<number>>(new Set())
  const [savingRecipes, setSavingRecipes] = useState(false)
  const [groceryLists, setGroceryLists] = useState<any[]>([])
  const [showGroceryListModal, setShowGroceryListModal] = useState(false)
  const [activeGroceryList, setActiveGroceryList] = useState<any>(null)
  const [showNewGroceryModal, setShowNewGroceryModal] = useState(false)
  const [newListName, setNewListName] = useState("")
  const [newListItems, setNewListItems] = useState<string[]>([""])
  const [addItemValue, setAddItemValue] = useState("")
  const [addAsHousehold, setAddAsHousehold] = useState(false)
  const [grocerySearch, setGrocerySearch] = useState("")
  const [savingNewList, setSavingNewList] = useState(false)
  const [showDeleteCookbookModal, setShowDeleteCookbookModal] = useState(false)
  const [cookbookToDelete, setCookbookToDelete] = useState<string | null>(null)
  const [isPublic, setIsPublic] = useState(0)
  const [showDeleteGroceryModal, setShowDeleteGroceryModal] = useState(false)
  const [groceryListToDelete, setGroceryListToDelete] = useState<number | null>(null)
  const [editingListName, setEditingListName] = useState(false)
  const [listNameInput, setListNameInput] = useState("")
  const [checking, setChecking] = useState(true)
  const [groceryCopied, setGroceryCopied] = useState(false)
  const [showGroceryCollabModal, setShowGroceryCollabModal] = useState(false)
  const [planStatus, setPlanStatus] = useState<any>(null)
  const [showAllCookbooks, setShowAllCookbooks] = useState(false)
  const [showAllCollabCookbooks, setShowAllCollabCookbooks] = useState(false)
  const [showAllGroceryLists, setShowAllGroceryLists] = useState(false)
  const [userId, setUserId] = useState<number | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login?code=returning")
    if (status === "authenticated") registerUser()
  }, [status])

  useEffect(() => {
    if (!userId) return
    return subscribe(`/updates/users/${userId}/cookbooks`, fetchCookbooks)
  }, [userId])

  async function registerUser() {
    try {
      const urlParams = new URLSearchParams(window.location.search)
      let code = urlParams.get("code")
      if (!code) code = localStorage.getItem("pendingInviteCode")
      if (code && code !== "" && code !== "returning") {
        const inviteRes = await fetch("/api/invite", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, email: session?.user?.email, name: session?.user?.name, image: session?.user?.image }),
        })
        const inviteData = await inviteRes.json()
        localStorage.removeItem("pendingInviteCode")
        if (inviteData.success) {
          // Let anyone watching the invite codes (admin panel) see it flip to Used
          pulse("/updates/invites")
          router.replace("/welcome")
          return
        }
        // Code already used — fall through to profile check below
      }
      const res = await fetch("/api/profile", { cache: "no-store" })
      const data = await res.json()
      if (!data.user) { router.replace("/"); return }
      if (!data.user.username) { router.replace("/welcome"); return }
      if (data.user.id) setUserId(data.user.id)
      fetchCookbooks()
      fetchGroceryLists()
      fetch("/api/subscription").then(r => r.ok ? r.json() : null).then(d => d && setPlanStatus(d)).catch(() => {})
    } catch (e) {
      // swallow — page will still render
    } finally {
      setChecking(false)
    }
  }

  async function fetchCookbooks() {
    const res = await fetch("/api/cookbooks")
    const data = await res.json()
    setCookbooks(data.cookbooks || [])
    setCollaboratedCookbooks(data.collaborated || [])
  }

  async function togglePin(book: any) {
    const newPinned = !book.is_pinned
    setCookbooks((prev: any[]) => {
      const updated = prev.map((b: any) => b.id === book.id ? { ...b, is_pinned: newPinned ? 1 : 0 } : b)
      return updated.sort((a: any, b: any) => {
        if ((b.is_pinned || 0) !== (a.is_pinned || 0)) return (b.is_pinned || 0) - (a.is_pinned || 0)
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
    })
    await fetch(`/api/cookbooks/${book.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_pinned: newPinned ? 1 : 0 }),
    })
  }

  async function fetchGroceryLists() {
    const res = await fetch("/api/grocery-lists")
    if (!res.ok) return
    const data = await res.json().catch(() => null)
    if (!data) return
    setGroceryLists(data.lists || [])
  }

  async function refreshActiveList(listId: number) {
    const res = await fetch("/api/grocery-lists")
    if (!res.ok) return
    const data = await res.json().catch(() => null)
    if (!data) return
    const lists = data.lists || []
    setGroceryLists(lists)
    const fresh = lists.find((l: any) => l.id === listId)
    if (fresh) setActiveGroceryList(fresh)
  }

  // Live-sync grocery lists between collaborators: refetch when any list we can see gets pulsed
  useEffect(() => {
    const unsubs = groceryLists.map((l: any) =>
      subscribe(`/updates/grocery/${l.id}`, async () => {
        const res = await fetch("/api/grocery-lists")
        // A failed/rate-limited refetch must never wipe local state — just skip
        // this sync tick and let the next pulse (or manual refresh) catch up.
        if (!res.ok) return
        const data = await res.json().catch(() => null)
        if (!data) return
        const lists = data.lists || []
        setGroceryLists(lists)
        setActiveGroceryList((prev: any) => {
          if (!prev) return prev
          const fresh = lists.find((fl: any) => fl.id === prev.id)
          if (!fresh) {
            // The list we're viewing was deleted (or we were removed) — close it
            setShowGroceryListModal(false)
            toast.info("This grocery list is no longer available.")
            return null
          }
          return fresh
        })
      })
    )
    return () => unsubs.forEach((u: any) => u())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groceryLists.map((l: any) => l.id).join(",")])

  async function toggleGroceryItem(itemId: number, checked: boolean) {
    const res = await fetch("/api/grocery-lists/check", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: itemId, checked }),
    })
    if (!res.ok) { toast.error("Could not update that item — try again."); return }
    setActiveGroceryList((prev: any) => ({ ...prev, items: prev.items.map((item: any) => item.id === itemId ? { ...item, checked: checked ? 1 : 0 } : item) }))
    setGroceryLists(prev => prev.map((list: any) => list.id === activeGroceryList?.id ? { ...list, items: list.items.map((item: any) => item.id === itemId ? { ...item, checked: checked ? 1 : 0 } : item) } : list))
    if (activeGroceryList) pulse(`/updates/grocery/${activeGroceryList.id}`)
  }

  async function deleteGroceryItem(itemId: number) {
    const res = await fetch("/api/grocery-lists", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: activeGroceryList.id, deleteItemIds: [itemId] }) })
    if (!res.ok) { toast.error("Could not remove that item — try again."); return }
    const updated = { ...activeGroceryList, items: activeGroceryList.items.filter((i: any) => i.id !== itemId) }
    setActiveGroceryList(updated)
    setGroceryLists(prev => prev.map((l: any) => l.id === updated.id ? updated : l))
    pulse(`/updates/grocery/${updated.id}`)
  }

  async function addItemToList(value: string) {
    if (!value.trim()) return
    const res = await fetch("/api/grocery-lists", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: activeGroceryList.id, addItems: [value.trim()], household: addAsHousehold }) })
    if (!res.ok) { toast.error("Could not add that item — try again."); return }
    await refreshActiveList(activeGroceryList.id)
    pulse(`/updates/grocery/${activeGroceryList.id}`)
  }

  async function toggleItemHousehold(item: any) {
    const next = item.is_household ? 0 : 1
    const res = await fetch("/api/grocery-lists", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: activeGroceryList.id, setHousehold: { id: item.id, is_household: next } }) })
    if (!res.ok) { toast.error("Could not move that item — try again."); return }
    setActiveGroceryList((prev: any) => ({ ...prev, items: prev.items.map((i: any) => i.id === item.id ? { ...i, is_household: next } : i) }))
    setGroceryLists(prev => prev.map((list: any) => list.id === activeGroceryList?.id ? { ...list, items: list.items.map((i: any) => i.id === item.id ? { ...i, is_household: next } : i) } : list))
    pulse(`/updates/grocery/${activeGroceryList.id}`)
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
    pulse(`/updates/grocery/${updated.id}`)
  }

  async function deleteGroceryList(id: number) { setGroceryListToDelete(id); setShowDeleteGroceryModal(true) }

  async function confirmDeleteGroceryList() {
    if (!groceryListToDelete) return
    const res = await fetch("/api/grocery-lists", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: groceryListToDelete }) })
    if (!res.ok) {
      toast.error("Could not delete this list — try again.")
      setShowDeleteGroceryModal(false)
      setGroceryListToDelete(null)
      return
    }
    pulse(`/updates/grocery/${groceryListToDelete}`)
    setGroceryLists(prev => prev.filter((l: any) => l.id !== groceryListToDelete))
    if (activeGroceryList?.id === groceryListToDelete) { setShowGroceryListModal(false); setActiveGroceryList(null) }
    setShowDeleteGroceryModal(false)
    setGroceryListToDelete(null)
  }

  function printGroceryList() {
    const list = activeGroceryList
    const unchecked = list.items?.filter((i: any) => !i.checked && !i.is_household) || []
    const household = list.items?.filter((i: any) => !i.checked && i.is_household) || []
    const checked = list.items?.filter((i: any) => i.checked) || []
    const rows = (items: any[], done: boolean) =>
      items.map((i: any) => `<div class="item ${done ? "done" : ""}"><span class="box">${done ? "✓" : ""}</span><span>${escapeHtml(i.ingredient)}</span></div>`).join("")
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(list.name)}</title><style>
      body{font-family:-apple-system,sans-serif;max-width:600px;margin:40px auto;padding:0 24px;color:#1f2937}
      .header{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #f3f4f6;padding-bottom:12px;margin-bottom:20px}
      .brand{color:#f97316;font-weight:700;font-size:13px}.date{color:#d1d5db;font-size:11px}
      h1{font-size:22px;font-weight:700;margin-bottom:4px}
      .progress{font-size:12px;color:#9ca3af;margin-bottom:20px}
      .item{display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid #f9fafb;font-size:14px}
      .box{width:16px;height:16px;border:1.5px solid #d1d5db;border-radius:4px;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;font-size:10px;color:#f97316}
      .done{opacity:.45;text-decoration:line-through}
      .section{font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;margin:18px 0 6px}
      .footer{margin-top:32px;font-size:11px;color:#d1d5db;border-top:1px solid #f3f4f6;padding-top:10px;display:flex;justify-content:space-between}
      @media print{@page{margin:16mm}body{padding:0}}
    </style></head><body>
      <div class="header"><span class="brand">SmartFlavr</span><span class="date">${new Date().toLocaleDateString()}</span></div>
      <h1>${escapeHtml(list.name)}</h1>
      <div class="progress">${checked.length} of ${list.items?.length || 0} items checked</div>
      ${unchecked.length ? rows(unchecked, false) : ""}
      ${household.length ? `<div class="section">Household</div>${rows(household, false)}` : ""}
      ${checked.length ? `<div class="section">Checked</div>${rows(checked, true)}` : ""}
      <div class="footer"><span>SmartFlavr</span><span>${escapeHtml(list.name)}</span></div>
    </body></html>`
    const win = window.open("", "_blank")
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.focus()
    setTimeout(() => win.print(), 400)
  }

  function copyGroceryText() {
    const list = activeGroceryList
    const unchecked = list.items?.filter((i: any) => !i.checked && !i.is_household) || []
    const household = list.items?.filter((i: any) => !i.checked && i.is_household) || []
    const checked = list.items?.filter((i: any) => i.checked) || []
    const lines = [
      list.name,
      "",
      ...unchecked.map((i: any) => `• ${i.ingredient}`),
      ...(household.length ? ["", "— household —", ...household.map((i: any) => `• ${i.ingredient}`)] : []),
      ...(checked.length ? ["", "— checked —", ...checked.map((i: any) => `✓ ${i.ingredient}`)] : []),
    ]
    navigator.clipboard.writeText(lines.join("\n"))
    setGroceryCopied(true)
    setTimeout(() => setGroceryCopied(false), 2000)
  }

  async function createNewGroceryList() {
    if (!newListName.trim()) return
    setSavingNewList(true)
    const items = newListItems.filter(i => i.trim())
    await fetch("/api/grocery-lists", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newListName.trim(), items }) })
    await fetchGroceryLists()
    setShowNewGroceryModal(false); setNewListName(""); setNewListItems([""]); setSavingNewList(false)
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
    const res = await fetch("/api/cookbooks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, cover_emoji: emoji, cover_color: color, cover_image: coverImage, is_public: isPublic }) })
    setLoading(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error || "Could not create this cookbook — try again.")
      return
    }
    setTitle(""); setEmoji("📖"); setColor("#F97316"); setCoverImage(""); setIsPublic(0); setShowModal(false)
    fetchCookbooks()
    if (userId) pulse(`/updates/users/${userId}/cookbooks`)
  }

  async function updateCookbook() {
    if (!editingCookbook) return
    setLoading(true)
    const res = await fetch(`/api/cookbooks/${editingCookbook.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: editingCookbook.title, cover_emoji: editingCookbook.cover_emoji, cover_color: editingCookbook.cover_color, cover_image: editingCookbook.cover_image || "", is_public: editingCookbook.is_public ?? 0 }) })
    setLoading(false)
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error || "Could not save changes — try again.")
      return
    }
    setShowEditModal(false); setEditingCookbook(null)
    fetchCookbooks()
    if (userId) pulse(`/updates/users/${userId}/cookbooks`)
  }

  async function deleteCookbook(id: string) { setCookbookToDelete(id); setShowDeleteCookbookModal(true) }

  async function confirmDeleteCookbook() {
    if (!cookbookToDelete) return
    const res = await fetch(`/api/cookbooks/${cookbookToDelete}`, { method: "DELETE" })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast.error(data.error || "Could not delete this cookbook.")
      return
    }
    // Kick collaborators who are viewing this cookbook right now
    pulse(`cookbooks/${cookbookToDelete}/lastUpdate`)
    setShowDeleteCookbookModal(false); setCookbookToDelete(null); setShowEditModal(false); setEditingCookbook(null)
    fetchCookbooks()
    if (userId) pulse(`/updates/users/${userId}/cookbooks`)
    toast.success("Cookbook deleted.")
  }

  function extractRecipe() {
    if (!url || !planStatus?.canUseAI) return
    // Fire-and-forget: lives in ExtractionProvider so it survives navigating away
    startUrlExtraction(url)
    setUrl("")
  }

  function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !planStatus?.canUseAI) return
    setImportCookbooks({})
    // Fire-and-forget: lives in ExtractionProvider so it survives navigating away
    startFileImport(file)
  }

  function toggleImportCookbook(recipeIndex: number, cookbookId: string) {
    setImportCookbooks(prev => { const current = prev[recipeIndex] || []; return { ...prev, [recipeIndex]: current.includes(cookbookId) ? current.filter(id => id !== cookbookId) : [...current, cookbookId] } })
  }

  const [quickCbName, setQuickCbName] = useState("")
  const [showQuickCb, setShowQuickCb] = useState(false)
  const [creatingCb, setCreatingCb] = useState(false)

  // Create a cookbook inline from the save/import modals and select it
  async function quickCreateCookbook(selectFor: "extract" | "import") {
    if (!quickCbName.trim() || creatingCb) return
    setCreatingCb(true)
    const res = await fetch("/api/cookbooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: quickCbName.trim(), cover_emoji: "📖", cover_color: "#F97316" }),
    })
    const data = await res.json()
    setCreatingCb(false)
    if (!data.id) return toast.error("Could not create cookbook.")
    await fetchCookbooks()
    if (selectFor === "extract") {
      setSelectedCookbooks(prev => [...prev, data.id])
    } else {
      setImportCookbooks(prev => {
        const next = { ...prev }
        importedRecipes.forEach((_, i) => { next[i] = [...(next[i] || []), data.id] })
        return next
      })
    }
    setQuickCbName("")
    setShowQuickCb(false)
    toast.success(`"${quickCbName.trim()}" created!`)
  }

  // Users with no cookbooks yet get one created automatically so saving always works
  async function ensureDefaultCookbook(): Promise<string | null> {
    const res = await fetch("/api/cookbooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "My Recipes", cover_emoji: "📖", cover_color: "#F97316" }),
    })
    const data = await res.json()
    await fetchCookbooks()
    return data.id ? String(data.id) : null
  }

  async function saveImportedRecipes() {
    if (importedRecipes.length === 0 || savingRecipes) return
    setSavingRecipes(true)
    let fallbackId: string | null = null
    if (cookbooks.length === 0) {
      fallbackId = await ensureDefaultCookbook()
      if (!fallbackId) { setSavingRecipes(false); return toast.error("Could not create a cookbook. Try again.") }
    }
    let saved = 0
    for (let i = 0; i < importedRecipes.length; i++) {
      const targets = fallbackId ? [fallbackId] : (importCookbooks[i] || [])
      for (const cookbookId of targets) {
        const { nutrition: _n, ...recipeData } = importedRecipes[i]
        const res = await fetch("/api/recipes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...recipeData, cookbook_id: cookbookId }) })
        if (res.status === 409) {
          if (!confirm(`You already have "${importedRecipes[i].title}" in that cookbook. Save it again anyway?`)) continue
          await fetch("/api/recipes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...recipeData, cookbook_id: cookbookId, allow_duplicate: true }) })
        }
        saved++
      }
    }
    closeImportModal(); setImportedRecipes([]); setImportCookbooks({}); setExpandedImports(new Set())
    setSavingRecipes(false)
    toast.success(fallbackId ? `Saved ${saved} recipe${saved !== 1 ? "s" : ""} to your new "My Recipes" cookbook!` : `Saved ${saved} recipe${saved !== 1 ? "s" : ""}!`)
  }

  async function saveRecipe() {
    if (!extractedRecipe || savingRecipes) return
    setSavingRecipes(true)
    let targets = selectedCookbooks
    if (targets.length === 0) {
      if (cookbooks.length > 0) { setSavingRecipes(false); return }
      const fallbackId = await ensureDefaultCookbook()
      if (!fallbackId) { setSavingRecipes(false); return toast.error("Could not create a cookbook. Try again.") }
      targets = [fallbackId]
    }
    for (const cookbookId of targets) {
      const { nutrition: _n, ...recipeData } = extractedRecipe
      const res = await fetch("/api/recipes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...recipeData, cookbook_id: cookbookId }) })
      if (res.status === 409) {
        const cbName = cookbooks.find((c: any) => c.id === cookbookId)?.title || "that cookbook"
        if (confirm(`You already have "${extractedRecipe.title}" in ${cbName}. Save it again anyway?`)) {
          await fetch("/api/recipes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...recipeData, cookbook_id: cookbookId, allow_duplicate: true }) })
        }
      }
    }
    clearExtractedRecipe(); setSelectedCookbooks([])
    setSavingRecipes(false)
    toast.success(`Recipe saved to ${targets.length} cookbook${targets.length > 1 ? "s" : ""}!`)
  }

  function toggleCookbook(id: string) {
    setSelectedCookbooks(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id])
  }

  if (status === "loading" || checking) return <PageSkeleton />

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-4xl mx-auto px-6 py-10">

        {planStatus && !planStatus.isAdminOrOwner && planStatus.weeklyLimit !== null && (() => {
          const { plan, aiUsesThisWeek, weeklyLimit, isTrial, isCancelled, planExpiresAt } = planStatus
          const daysLeft = planExpiresAt ? Math.max(0, Math.ceil((new Date(planExpiresAt).getTime() - Date.now()) / 86400000)) : null

          if (plan === "free") return (
            <div className="flex items-center justify-between bg-white border border-gray-100 rounded-xl px-4 py-2.5 mb-6">
              <span className="text-xs text-gray-400">
                Free plan &mdash; <span className="text-gray-700 font-medium">{aiUsesThisWeek ?? 0} of {weeklyLimit ?? 5}</span> AI uses this week
              </span>
              <Link href="/profile/settings?tab=plan" className="text-xs text-orange-500 hover:text-orange-600 font-medium transition">View plan →</Link>
            </div>
          )

          if (plan === "pro" && isTrial) return (
            <div className="flex items-center justify-between bg-orange-50 border border-orange-100 rounded-xl px-4 py-2.5 mb-6">
              <span className="text-xs text-orange-700">
                <span className="font-semibold">Pro trial</span> &mdash; {daysLeft !== null ? `${daysLeft} day${daysLeft !== 1 ? "s" : ""} left` : "active"} &mdash; <span className="font-medium">{aiUsesThisWeek ?? 0} of 25</span> AI uses this week
              </span>
              <Link href="/profile/settings?tab=plan" className="text-xs text-orange-500 hover:text-orange-600 font-medium transition">View plan →</Link>
            </div>
          )

          if (plan === "pro") return (
            <div className="flex items-center justify-between bg-white border border-gray-100 rounded-xl px-4 py-2.5 mb-6">
              <span className="text-xs text-gray-400">
                <span className="text-gray-700 font-semibold">Pro</span> &mdash; <span className="font-medium text-gray-700">{aiUsesThisWeek ?? 0} of 25</span> AI uses this week
                {isCancelled && daysLeft !== null && <span className="text-orange-500 ml-1">· ends in {daysLeft}d</span>}
              </span>
              <Link href="/profile/settings?tab=plan" className="text-xs text-orange-500 hover:text-orange-600 font-medium transition">View plan →</Link>
            </div>
          )

          if (plan === "premium") return (
            <div className="flex items-center justify-between bg-white border border-gray-100 rounded-xl px-4 py-2.5 mb-6">
              <span className="text-xs text-gray-400">
                <span className="text-gray-700 font-semibold">Premium</span> &mdash; unlimited AI access
                {isCancelled && daysLeft !== null && <span className="text-orange-500 ml-1">· ends in {daysLeft}d</span>}
              </span>
              <Link href="/profile/settings?tab=plan" className="text-xs text-orange-500 hover:text-orange-600 font-medium transition">View plan →</Link>
            </div>
          )

          return null
        })()}

        <div className="mb-8">
          <h2 className="text-lg font-medium text-gray-900 mb-1">Import a Recipe</h2>
          <p className="text-sm text-gray-400 mb-4">SmartFlavr can read recipes from the web or your files and save them straight to your cookbooks.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-gray-100 rounded-2xl p-5">
              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500 mb-3"><LinkIcon size={20} /></div>
              <h3 className="text-sm font-medium text-gray-900 mb-1">Extract from URL</h3>
              <p className="text-xs text-gray-400 mb-4 leading-relaxed">Paste a link from any recipe site and we'll pull out the ingredients, steps, and details automatically.</p>
              <div className="flex gap-2 mb-3">
                <input value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === "Enter" && extractRecipe()} placeholder="https://allrecipes.com/recipe/..." className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none bg-gray-50"/>
                <button onClick={extractRecipe} disabled={!planStatus?.canUseAI || extracting} title={!planStatus?.canUseAI ? "AI limit reached for this week" : undefined} className="bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-orange-600 transition whitespace-nowrap disabled:opacity-50">{extracting ? "Extracting..." : "Extract"}</button>
              </div>
              <p className="text-xs text-gray-400 mb-2">Works with</p>
              <div className="flex flex-wrap gap-1.5">
                {["AllRecipes", "Pinterest", "Food Network", "Tasty", "NYT Cooking", "+ most recipe sites"].map(s => (
                  <span key={s} className="text-xs px-2.5 py-1 rounded-full border border-gray-100 text-gray-400 bg-gray-50">{s}</span>
                ))}
              </div>
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl p-5">
              <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500 mb-3"><DocumentIcon size={20} /></div>
              <h3 className="text-sm font-medium text-gray-900 mb-1">Import from file</h3>
              <p className="text-xs text-gray-400 mb-4 leading-relaxed">Upload a photo of a recipe card, a PDF cookbook page, or a text file — AI will do the reading.</p>
              <p className="text-xs text-gray-400 mb-2">Supported formats</p>
              <div className="flex flex-wrap gap-1.5 mb-4">
                <span className="text-xs px-2.5 py-1 rounded-full bg-orange-50 text-orange-600 flex items-center gap-1"><CameraIcon size={11} />Photo</span>
                <span className="text-xs px-2.5 py-1 rounded-full bg-orange-50 text-orange-600 flex items-center gap-1"><DocumentIcon size={11} />PDF</span>
                <span className="text-xs px-2.5 py-1 rounded-full bg-orange-50 text-orange-600 flex items-center gap-1"><DocumentIcon size={11} />Text file</span>
              </div>
              <button onClick={() => document.getElementById("file-import")?.click()} disabled={!planStatus?.canUseAI} title={!planStatus?.canUseAI ? "AI limit reached for this week" : undefined} className="w-full border border-gray-200 text-gray-600 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition text-center disabled:opacity-50">Choose a file to import</button>
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

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {(showAllCookbooks ? cookbooks : cookbooks.slice(0, 6)).map((book: any, i: number) => (
            <div key={book.id} className={`bg-white border border-gray-100 rounded-2xl overflow-hidden hover:shadow-sm transition relative${!showAllCookbooks && i >= 4 ? " hidden md:block" : ""}`}>
              <Link href={`/cookbook/${book.id}`} className="block">
                <div className="h-24 flex items-center justify-center overflow-hidden" style={{ backgroundColor: book.cover_image ? "transparent" : book.cover_color + "22" }}>
                  {book.cover_image ? <img src={book.cover_image} className="w-full h-full object-cover"/> : <span className="text-4xl">{book.cover_emoji}</span>}
                </div>
                <div className="p-3 pr-9">
                  <div className="font-medium text-sm text-gray-900 truncate">{book.title}</div>
                  {book.is_public === 1 && <span className="text-xs text-orange-500 font-medium">Public</span>}
                </div>
              </Link>
              <button
                onClick={() => { setEditingCookbook({ ...book }); setShowEditModal(true) }}
                className="absolute top-2 right-2 w-7 h-7 bg-white/90 shadow-sm rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 text-xs transition">
                <PencilIcon size={12} />
              </button>
              <button
                onClick={() => togglePin(book)}
                title={book.is_pinned ? "Unpin" : "Pin to top"}
                className={`absolute top-2 left-2 w-7 h-7 bg-white/90 shadow-sm rounded-lg flex items-center justify-center text-xs transition ${book.is_pinned ? "text-orange-500" : "text-gray-300 hover:text-gray-500"}`}>
                <PinIcon filled={!!book.is_pinned} size={12} />
              </button>
            </div>
          ))}
          <div onClick={() => setShowModal(true)} className="bg-white border border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center p-8 cursor-pointer hover:bg-gray-50 transition">
            <span className="text-3xl text-gray-300 mb-2">+</span>
            <span className="text-sm text-gray-400">New cookbook</span>
          </div>
        </div>
        {!showAllCookbooks && cookbooks.length > 4 && (
          <button
            onClick={() => setShowAllCookbooks(true)}
            className={`mt-3 text-sm text-orange-500 hover:text-orange-600 font-medium transition${cookbooks.length <= 6 ? " md:hidden" : ""}`}>
            View all {cookbooks.length} cookbooks →
          </button>
        )}
        {showAllCookbooks && cookbooks.length > 4 && (
          <button onClick={() => setShowAllCookbooks(false)} className="mt-3 text-sm text-gray-400 hover:text-gray-600 transition">Show less ↑</button>
        )}
        <div className="mb-10" />

        {collaboratedCookbooks.length > 0 && (
          <div className="mb-10">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Shared with me</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {(showAllCollabCookbooks ? collaboratedCookbooks : collaboratedCookbooks.slice(0, 6)).map((book: any, i: number) => (
                <div key={book.id} onClick={() => router.push(`/cookbook/${book.id}`)} className={`bg-white border border-gray-100 rounded-2xl overflow-hidden cursor-pointer hover:shadow-sm transition${!showAllCollabCookbooks && i >= 4 ? " hidden md:block" : ""}`}>
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
            {!showAllCollabCookbooks && collaboratedCookbooks.length > 4 && (
              <button onClick={() => setShowAllCollabCookbooks(true)} className={`mt-3 text-sm text-orange-500 hover:text-orange-600 font-medium transition${collaboratedCookbooks.length <= 6 ? " md:hidden" : ""}`}>
                View all {collaboratedCookbooks.length} shared cookbooks →
              </button>
            )}
            {showAllCollabCookbooks && collaboratedCookbooks.length > 4 && (
              <button onClick={() => setShowAllCollabCookbooks(false)} className="mt-3 text-sm text-gray-400 hover:text-gray-600 transition">Show less ↑</button>
            )}
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900">My Grocery Lists</h2>
            <button onClick={() => { setShowNewGroceryModal(true); setNewListName(""); setNewListItems([""]) }} className="bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-orange-600 transition">+ New List</button>
          </div>
          {groceryLists.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center p-10 text-center">
              <div className="w-12 h-12 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-300 mb-3"><ListIcon size={24} /></div>
              <p className="text-sm text-gray-400">No grocery lists yet</p>
              <p className="text-xs text-gray-300 mt-1">Create one manually or generate from your meal plan</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {(showAllGroceryLists ? groceryLists : groceryLists.slice(0, 5)).map((list: any) => {
                const total = list.items?.length || 0
                const checkedCount = list.items?.filter((i: any) => i.checked).length || 0
                const pct = total > 0 ? Math.round((checkedCount / total) * 100) : 0
                return (
                  <div key={list.id} className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center justify-between gap-4 hover:shadow-sm transition">
                    <div className="flex-1 cursor-pointer min-w-0" onClick={() => { setActiveGroceryList(list); setShowGroceryListModal(true) }}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium text-sm text-gray-900 truncate">{list.name}</span>
                        {list.shared_by && <span className="text-[10px] font-medium text-blue-500 bg-blue-50 border border-blue-100 rounded-full px-2 py-0.5 flex-shrink-0 max-w-[45%] truncate">Shared by {list.shared_by}</span>}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">{total} items · {pct}% done</div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
                        <div className="bg-orange-400 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }}/>
                      </div>
                    </div>
                    {list.shared_by ? (
                      <button
                        onClick={async () => {
                          if (!confirm("Leave this shared list? You'll need a new invite to rejoin.")) return
                          await fetch("/api/grocery-list-collaborators", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ list_id: list.id, user_id: "self" }) })
                          fetchGroceryLists()
                        }}
                        className="text-xs text-red-400 hover:text-red-600 border border-red-100 hover:border-red-300 rounded-lg px-3 py-1.5 transition flex-shrink-0">
                        Leave
                      </button>
                    ) : (
                      <button onClick={() => deleteGroceryList(list.id)} className="text-xs text-red-400 hover:text-red-600 border border-red-100 hover:border-red-300 rounded-lg px-3 py-1.5 transition flex-shrink-0">Delete</button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          {!showAllGroceryLists && groceryLists.length > 5 && (
            <button onClick={() => setShowAllGroceryLists(true)} className="mt-3 text-sm text-orange-500 hover:text-orange-600 font-medium transition">
              View all {groceryLists.length} lists →
            </button>
          )}
          {showAllGroceryLists && groceryLists.length > 5 && (
            <button onClick={() => setShowAllGroceryLists(false)} className="mt-3 text-sm text-gray-400 hover:text-gray-600 transition">Show less ↑</button>
          )}
        </div>

      </div>

      {showGroceryListModal && activeGroceryList && (
        <div
          className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50"
          onClick={e => {
            if (e.target !== e.currentTarget) return
            setShowGroceryListModal(false); setActiveGroceryList(null); setAddItemValue("")
          }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 max-h-[85vh] overflow-y-auto">
            {/* List name */}
            <div className="mb-3">
              {editingListName ? (
                <input value={listNameInput} onChange={e => setListNameInput(e.target.value)}
                  onBlur={async () => {
                    if (listNameInput.trim() && listNameInput !== activeGroceryList.name) {
                      await fetch("/api/grocery-lists", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: activeGroceryList.id, name: listNameInput.trim() }) })
                      pulse(`/updates/grocery/${activeGroceryList.id}`)
                      setActiveGroceryList((prev: any) => ({ ...prev, name: listNameInput.trim() }))
                      setGroceryLists(prev => prev.map((l: any) => l.id === activeGroceryList.id ? { ...l, name: listNameInput.trim() } : l))
                    }
                    setEditingListName(false)
                  }}
                  onKeyDown={e => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                  autoFocus className="text-lg font-medium border-b border-orange-300 outline-none w-full"/>
              ) : (
                <h2 onClick={() => { setListNameInput(activeGroceryList.name); setEditingListName(true) }} className="text-lg font-medium cursor-pointer hover:text-orange-500 transition flex items-center gap-2" title="Click to rename">
                  {activeGroceryList.name} <PencilIcon size={13} className="text-gray-300" />
                </h2>
              )}
            </div>
            {activeGroceryList.shared_by && (
              <p className="text-xs text-blue-500 mb-2">Shared by {activeGroceryList.shared_by}</p>
            )}
            {/* Actions row */}
            <div className="flex items-center gap-2 mb-4">
              {activeGroceryList.shared_by ? (
                <button
                  onClick={async () => {
                    if (!confirm("Leave this shared list? You'll need a new invite to rejoin.")) return
                    await fetch("/api/grocery-list-collaborators", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ list_id: activeGroceryList.id, user_id: "self" }) })
                    setShowGroceryListModal(false)
                    setActiveGroceryList(null)
                    fetchGroceryLists()
                  }}
                  className="text-xs text-red-400 hover:text-red-600 border border-red-100 hover:border-red-300 rounded-lg px-3 py-2 transition">
                  Leave list
                </button>
              ) : (
                <button onClick={() => deleteGroceryList(activeGroceryList.id)} className="text-xs text-red-400 hover:text-red-600 border border-red-100 hover:border-red-300 rounded-lg px-3 py-2 transition">Delete list</button>
              )}
              <div className="flex-1" />
              <button onClick={printGroceryList} className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-2 flex items-center gap-1.5 transition"><PrintIcon size={12} />Print</button>
              <button onClick={copyGroceryText} className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-2 flex items-center gap-1.5 transition">{groceryCopied ? <><CheckIcon size={12} />Copied!</> : <><ListIcon size={12} />Copy</>}</button>
              {!activeGroceryList.shared_by && (
                <button onClick={() => setShowGroceryCollabModal(true)} className="text-xs text-orange-500 hover:text-orange-600 border border-orange-200 hover:border-orange-300 rounded-lg px-3 py-2 transition">Collaborate</button>
              )}
            </div>
            <p className="text-xs text-gray-400 mb-2">{activeGroceryList.items?.filter((i: any) => i.checked).length} of {activeGroceryList.items?.length} items checked</p>
            <div className="w-full bg-gray-100 rounded-full h-1.5 mb-4">
              <div className="bg-orange-400 h-1.5 rounded-full transition-all" style={{ width: `${activeGroceryList.items?.length > 0 ? Math.round((activeGroceryList.items.filter((i: any) => i.checked).length / activeGroceryList.items.length) * 100) : 0}%` }}/>
            </div>
            <div className="flex gap-2 mb-4">
              <a href="https://www.hy-vee.com/aisles-online/" target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-2 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-100 rounded-xl transition">
                <LinkIcon size={13} /><span className="text-xs font-medium text-gray-600">Hy-Vee</span>
              </a>
              <a href="https://www.walmart.com" target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-2 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-100 rounded-xl transition">
                <LinkIcon size={13} /><span className="text-xs font-medium text-gray-600">Walmart</span>
              </a>
              <a href="https://shop.fareway.com" target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center gap-2 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-100 rounded-xl transition">
                <LinkIcon size={13} /><span className="text-xs font-medium text-gray-600">Fareway</span>
              </a>
            </div>
            {(activeGroceryList.items?.length || 0) > 5 && (
              <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2 mb-3">
                <SearchIcon size={13} className="text-gray-300 flex-shrink-0" />
                <input
                  value={grocerySearch}
                  onChange={e => setGrocerySearch(e.target.value)}
                  placeholder="Search this list..."
                  className="flex-1 text-[16px] md:text-sm outline-none bg-transparent min-w-0 placeholder:text-gray-300"
                />
                {grocerySearch && <button onClick={() => setGrocerySearch("")} className="text-gray-300 hover:text-gray-500 text-xs flex-shrink-0">✕</button>}
              </div>
            )}
            <div className="border border-gray-200 rounded-xl overflow-hidden mb-4">
              {(() => {
                const q = grocerySearch.trim().toLowerCase()
                const matches = (i: any) => !q || i.ingredient.toLowerCase().includes(q)
                const foodItems = (activeGroceryList.items || []).filter((i: any) => !i.is_household && matches(i))
                const householdItems = (activeGroceryList.items || []).filter((i: any) => i.is_household && matches(i))
                return (
                  <>
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleGroceryDragEnd}>
                      <SortableContext items={foodItems.map((i: any) => i.id)} strategy={verticalListSortingStrategy}>
                        {foodItems.map((item: any) => (
                          <SortableGroceryItem key={item.id} item={item} onToggle={toggleGroceryItem} onDelete={deleteGroceryItem} onHousehold={toggleItemHousehold}/>
                        ))}
                      </SortableContext>
                    </DndContext>
                    {householdItems.length > 0 && (
                      <>
                        <div className="flex items-center gap-2 px-3 pt-3 pb-1 border-t border-gray-100">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
                          <span className="text-[10px] font-semibold text-blue-400 uppercase tracking-wide">Household</span>
                          <span className="text-[10px] text-gray-300">not added to inventory</span>
                        </div>
                        {householdItems.map((item: any) => (
                          <HouseholdGroceryItem key={item.id} item={item} onToggle={toggleGroceryItem} onDelete={deleteGroceryItem} onHousehold={toggleItemHousehold}/>
                        ))}
                      </>
                    )}
                    {q && foodItems.length === 0 && householdItems.length === 0 && (
                      <p className="text-sm text-gray-300 text-center py-6">Nothing matches "{grocerySearch}"</p>
                    )}
                  </>
                )
              })()}
              <div className={`flex items-center gap-2.5 px-3 ${activeGroceryList.items?.length > 0 ? "border-t border-dashed border-gray-200" : ""}`}>
                <div className="w-3.5 h-3.5 rounded-full border-2 border-dashed border-gray-300 flex-shrink-0" />
                <input
                  value={addItemValue}
                  onChange={e => setAddItemValue(e.target.value)}
                  onKeyDown={async e => {
                    if (e.key === "Enter" && addItemValue.trim()) {
                      e.preventDefault()
                      await addItemToList(addItemValue)
                      setAddItemValue("")
                    }
                  }}
                  placeholder={addAsHousehold ? "Add household item..." : "Add item..."}
                  className="flex-1 text-[16px] md:text-sm outline-none bg-transparent py-2.5 min-w-0 placeholder:text-gray-300"
                />
                <button
                  onClick={() => setAddAsHousehold(h => !h)}
                  title="Household items (toilet paper, soap...) stay out of your kitchen inventory"
                  className={`text-[10px] font-semibold rounded-full px-2.5 py-1 border transition flex-shrink-0 ${addAsHousehold ? "bg-blue-500 text-white border-blue-500" : "border-gray-200 text-gray-400 hover:bg-gray-50"}`}>
                  Household
                </button>
              </div>
            </div>
            <button onClick={() => { setShowGroceryListModal(false); setActiveGroceryList(null); setAddItemValue(""); setGrocerySearch("") }} className="w-full border border-gray-200 rounded-xl py-2 text-sm text-gray-500 hover:bg-gray-50">Done</button>
          </div>
        </div>
      )}

      {showNewGroceryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50" onClick={e => { if (e.target === e.currentTarget) setShowNewGroceryModal(false) }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 max-h-[85vh] overflow-y-auto">
            <h2 className="text-lg font-medium mb-4">New Grocery List</h2>
            <div className="mb-4">
              <label className="text-sm text-gray-500 mb-1 block">List name</label>
              <input value={newListName} onChange={e => setNewListName(e.target.value)} placeholder="e.g. Weekly Shop" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none"/>
            </div>
            <div className="mb-6">
              <label className="text-sm text-gray-500 mb-1 block">Items</label>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                {newListItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-2.5 px-3 border-b border-gray-100 last:border-0 group">
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-200 flex-shrink-0" />
                    <input
                      data-newitem={i}
                      value={item}
                      onChange={e => setNewListItems(prev => { const a = [...prev]; a[i] = e.target.value; return a })}
                      onKeyDown={e => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          setNewListItems(prev => { const a = [...prev]; a.splice(i + 1, 0, ""); return a })
                          setTimeout(() => { const els = document.querySelectorAll<HTMLInputElement>("[data-newitem]"); els[i + 1]?.focus() }, 0)
                        } else if (e.key === "Backspace" && item === "" && newListItems.length > 1) {
                          e.preventDefault()
                          setNewListItems(prev => { const a = [...prev]; a.splice(i, 1); return a })
                          setTimeout(() => { const els = document.querySelectorAll<HTMLInputElement>("[data-newitem]"); els[Math.max(0, i - 1)]?.focus() }, 0)
                        }
                      }}
                      placeholder={i === 0 ? "e.g. 2 cups chicken broth" : "Add item..."}
                      className="flex-1 text-[16px] md:text-sm outline-none bg-transparent py-2.5 min-w-0"
                    />
                    {newListItems.length > 1 && (
                      <button onClick={() => setNewListItems(prev => prev.filter((_, j) => j !== i))} className="text-gray-200 hover:text-red-400 text-xs opacity-0 group-hover:opacity-100 transition p-1">✕</button>
                    )}
                  </div>
                ))}
              </div>
            </div>
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
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Italian Classics" className="border border-gray-200 rounded-lg px-3 py-2 w-full text-[16px] md:text-sm"/>
            </div>
            <div className="mb-4">
              <label className="text-sm text-gray-500 mb-1 block">Cover image (optional)</label>
              <div onClick={() => document.getElementById("cover-upload-new")?.click()} className="border-2 border-dashed border-gray-100 rounded-xl h-24 flex items-center justify-center cursor-pointer hover:bg-gray-50 overflow-hidden">
                {coverImage ? <img src={coverImage} className="w-full h-full object-cover rounded-xl"/> : <span className="text-xs text-gray-400 flex items-center gap-1"><CameraIcon size={13} />Click to add cover photo</span>}
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
                <button onClick={() => setIsPublic(0)} className={`flex-1 py-2 rounded-xl text-sm border transition flex items-center justify-center gap-1.5 ${isPublic === 0 ? "bg-gray-900 text-white border-gray-900" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}><LockIcon size={13} />Private</button>
                <button onClick={() => setIsPublic(1)} className={`flex-1 py-2 rounded-xl text-sm border transition flex items-center justify-center gap-1.5 ${isPublic === 1 ? "bg-orange-500 text-white border-orange-500" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}><GlobeIcon size={13} />Public</button>
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
              <input value={editingCookbook.title} onChange={e => setEditingCookbook({ ...editingCookbook, title: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-2 w-full text-[16px] md:text-sm"/>
            </div>
            <div className="mb-4">
              <label className="text-sm text-gray-500 mb-1 block">Cover image (optional)</label>
              <div onClick={() => document.getElementById("cover-upload-edit")?.click()} className="border-2 border-dashed border-gray-100 rounded-xl h-24 flex items-center justify-center cursor-pointer hover:bg-gray-50 overflow-hidden">
                {editingCookbook.cover_image ? <img src={editingCookbook.cover_image} className="w-full h-full object-cover rounded-xl"/> : <span className="text-xs text-gray-400 flex items-center gap-1"><CameraIcon size={13} />Click to add cover photo</span>}
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
                <button onClick={() => setEditingCookbook({ ...editingCookbook, is_public: 0 })} className={`flex-1 py-2 rounded-xl text-sm border transition flex items-center justify-center gap-1.5 ${editingCookbook.is_public === 0 || !editingCookbook.is_public ? "bg-gray-900 text-white border-gray-900" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}><LockIcon size={13} />Private</button>
                <button onClick={() => setEditingCookbook({ ...editingCookbook, is_public: 1 })} className={`flex-1 py-2 rounded-xl text-sm border transition flex items-center justify-center gap-1.5 ${editingCookbook.is_public === 1 ? "bg-orange-500 text-white border-orange-500" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}><GlobeIcon size={13} />Public</button>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => deleteCookbook(editingCookbook.id)} className="px-4 py-2 border border-red-200 text-red-400 rounded-xl text-sm hover:bg-red-50">Delete</button>
              <button onClick={() => {
                const orig = cookbooks.find((b: any) => b.id === editingCookbook.id)
                const dirty = orig && (orig.title !== editingCookbook.title || (orig.cover_image || "") !== (editingCookbook.cover_image || "") || (orig.cover_emoji || "") !== (editingCookbook.cover_emoji || "") || (orig.cover_color || "") !== (editingCookbook.cover_color || "") || (orig.is_public || 0) !== (editingCookbook.is_public || 0))
                if (dirty && !confirm("Discard your changes to this cookbook?")) return
                setShowEditModal(false); setEditingCookbook(null)
              }} className="flex-1 border border-gray-200 rounded-xl py-2 text-sm text-gray-500 hover:bg-gray-50">Cancel</button>
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
                {showQuickCb ? (
                  <div className="flex gap-2 p-2">
                    <input
                      value={quickCbName}
                      onChange={e => setQuickCbName(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && quickCreateCookbook("extract")}
                      placeholder="Cookbook name..."
                      autoFocus
                      className="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none"
                    />
                    <button onClick={() => quickCreateCookbook("extract")} disabled={creatingCb || !quickCbName.trim()} className="px-3 py-1.5 bg-orange-500 text-white rounded-lg text-xs font-medium disabled:opacity-50">{creatingCb ? "..." : "Create"}</button>
                    <button onClick={() => { setShowQuickCb(false); setQuickCbName("") }} className="px-2 text-gray-300 hover:text-gray-500">✕</button>
                  </div>
                ) : (
                  <button onClick={() => setShowQuickCb(true)} className="flex items-center gap-3 p-2 rounded-xl hover:bg-orange-50 text-orange-500 text-sm w-full text-left">
                    <span className="w-4 h-4 flex items-center justify-center text-base leading-none">+</span>
                    New cookbook
                  </button>
                )}
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { if (!confirm("Discard this extracted recipe? You'll need to extract it again to get it back.")) return; clearExtractedRecipe(); setSelectedCookbooks([]) }} className="flex-1 border border-gray-200 rounded-xl py-2 text-sm text-gray-500 hover:bg-gray-50">Discard</button>
              <button onClick={saveRecipe} disabled={savingRecipes || (selectedCookbooks.length === 0 && cookbooks.length > 0)} className="flex-1 bg-orange-500 text-white rounded-xl py-2 text-sm font-medium hover:bg-orange-600 disabled:opacity-50">
                {savingRecipes ? "Saving..." : cookbooks.length === 0 ? "Save to a new cookbook" : `Save to ${selectedCookbooks.length > 0 ? `${selectedCookbooks.length} cookbook${selectedCookbooks.length > 1 ? "s" : ""}` : "cookbook"}`}
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
                <div className="text-gray-400 mb-3 flex justify-center"><SparkleIcon size={40} /></div>
                <p className="text-sm text-gray-500">AI is reading your file...</p>
                <p className="text-xs text-gray-400 mt-1">This may take a few seconds</p>
              </div>
            ) : importedRecipes.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-gray-500">No recipes found</p>
                <button onClick={() => closeImportModal()} className="mt-4 border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-500 hover:bg-gray-50">Close</button>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-500 mb-4">Found {importedRecipes.length} recipe{importedRecipes.length > 1 ? "s" : ""}! Select which cookbooks to save each to.</p>
                <div className="space-y-4 mb-4">
                  {importedRecipes.map((r, i) => (
                    <div key={i} className="bg-gray-50 rounded-xl p-3">
                      <div className="font-medium text-sm mb-1">{r.title}</div>
                      {r.description && <div className="text-xs text-gray-500 mb-2 line-clamp-2">{r.description}</div>}
                      <div className="flex gap-3 mb-2 text-xs text-gray-400">
                        {r.prep_time && <span className="flex items-center gap-1"><ClockIcon size={11} />{r.prep_time}</span>}
                        {r.servings && <span className="flex items-center gap-1"><UserIcon size={11} />{r.servings}</span>}
                        {r.difficulty && <span className="flex items-center gap-1"><StarIcon size={11} />{r.difficulty}</span>}
                      </div>
                      <button
                        onClick={() => setExpandedImports(prev => { const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next })}
                        className="text-xs text-orange-500 hover:text-orange-600 mb-2">
                        {expandedImports.has(i) ? "Hide full recipe ▴" : "See full recipe ▾"}
                      </button>
                      {expandedImports.has(i) && (
                        <div className="bg-white rounded-lg p-3 mb-3 space-y-3 border border-gray-100">
                          {r.ingredients && (
                            <div>
                              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Ingredients</p>
                              <p className="text-xs text-gray-700 whitespace-pre-line leading-relaxed">{r.ingredients}</p>
                            </div>
                          )}
                          {r.instructions && (
                            <div>
                              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Instructions</p>
                              <p className="text-xs text-gray-700 whitespace-pre-line leading-relaxed">{r.instructions}</p>
                            </div>
                          )}
                          {r.notes && (
                            <div>
                              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Notes</p>
                              <p className="text-xs text-gray-700 whitespace-pre-line leading-relaxed">{r.notes}</p>
                            </div>
                          )}
                        </div>
                      )}
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
                {showQuickCb ? (
                  <div className="flex gap-2 mb-3">
                    <input
                      value={quickCbName}
                      onChange={e => setQuickCbName(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && quickCreateCookbook("import")}
                      placeholder="Cookbook name..."
                      autoFocus
                      className="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none"
                    />
                    <button onClick={() => quickCreateCookbook("import")} disabled={creatingCb || !quickCbName.trim()} className="px-3 py-1.5 bg-orange-500 text-white rounded-lg text-xs font-medium disabled:opacity-50">{creatingCb ? "..." : "Create"}</button>
                    <button onClick={() => { setShowQuickCb(false); setQuickCbName("") }} className="px-2 text-gray-300 hover:text-gray-500">✕</button>
                  </div>
                ) : (
                  <button onClick={() => setShowQuickCb(true)} className="text-sm text-orange-500 hover:text-orange-600 mb-3 flex items-center gap-1.5">
                    <span className="text-base leading-none">+</span> New cookbook (selects it for all recipes)
                  </button>
                )}
                <div className="flex gap-3">
                  <button onClick={() => { closeImportModal(); setImportedRecipes([]); setImportCookbooks({}) }} className="flex-1 border border-gray-200 rounded-xl py-2 text-sm text-gray-500 hover:bg-gray-50">Cancel</button>
                  <button onClick={saveImportedRecipes} disabled={savingRecipes || (cookbooks.length > 0 && Object.values(importCookbooks).every(v => v.length === 0))} className="flex-1 bg-orange-500 text-white rounded-xl py-2 text-sm font-medium hover:bg-orange-600 disabled:opacity-50">
                    {savingRecipes ? "Saving..." : cookbooks.length === 0 ? `Save ${importedRecipes.length} to a new cookbook` : `Save ${Object.values(importCookbooks).flat().length} to cookbook${Object.values(importCookbooks).flat().length !== 1 ? "s" : ""}`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showGroceryCollabModal && activeGroceryList && (
        <GroceryCollaboratorModal
          listId={activeGroceryList.id}
          listName={activeGroceryList.name}
          onClose={() => setShowGroceryCollabModal(false)}
        />
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