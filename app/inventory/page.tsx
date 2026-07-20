"use client"
import { useEffect, useRef, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Navbar from "@/app/components/Navbar"
import { ListIcon, PlateIcon, FlameIcon, ClockIcon, SparkleIcon, ChefIcon } from "@/app/components/Icons"
import { toast } from "@/app/components/Toast"
import { PageSkeleton } from "@/app/components/Skeletons"
import type { ReactElement } from "react"

const CATEGORIES = ["Pantry", "Produce", "Proteins", "Dairy", "Frozen", "Spices"]

const CATEGORY_ICONS: Record<string, ReactElement> = {
  Pantry:   <ListIcon size={13} />,
  Produce:  <SparkleIcon size={13} />,
  Proteins: <PlateIcon size={13} />,
  Dairy:    <ClockIcon size={13} />,
  Frozen:   <ChefIcon size={13} />,
  Spices:   <FlameIcon size={13} />,
}

function daysUntilDelete(usedAt: string) {
  const used = new Date(usedAt).getTime()
  const deleteAt = used + 10 * 24 * 60 * 60 * 1000
  const now = Date.now()
  return Math.ceil((deleteAt - now) / (1000 * 60 * 60 * 24))
}

function daysSinceUsed(usedAt: string) {
  const used = new Date(usedAt).getTime()
  const now = Date.now()
  return Math.floor((now - used) / (1000 * 60 * 60 * 24))
}

function expiryInfo(expiresAt: string | null | undefined) {
  if (!expiresAt) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const expires = new Date(expiresAt); expires.setHours(0, 0, 0, 0)
  const days = Math.round((expires.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (days < 0) return { label: "Expired", days, className: "bg-red-50 text-red-600 border-red-100" }
  if (days === 0) return { label: "Expires today", days, className: "bg-red-50 text-red-600 border-red-100" }
  if (days <= 3) return { label: `Expires in ${days}d`, days, className: "bg-amber-50 text-amber-600 border-amber-100" }
  return { label: `Expires in ${days}d`, days, className: "bg-gray-50 text-gray-400 border-gray-100" }
}

export default function InventoryPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState("All")
  const [newName, setNewName] = useState("")
  const [newQty, setNewQty] = useState("")
  const [newCategory, setNewCategory] = useState("Pantry")
  const [adding, setAdding] = useState(false)
  const [groceryLists, setGroceryLists] = useState<any[]>([])
  const [showImportModal, setShowImportModal] = useState(false)
  const [selectedList, setSelectedList] = useState<any>(null)
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set())
  const [importing, setImporting] = useState(false)
  const [showGroceryModal, setShowGroceryModal] = useState(false)
  const [groceryItem, setGroceryItem] = useState<any>(null)
  const [targetListId, setTargetListId] = useState<string>("")
  const [planStatus, setPlanStatus] = useState<any>(null)
  const [finding, setFinding] = useState(false)
  const [matches, setMatches] = useState<any[] | null>(null)
  const [showMatches, setShowMatches] = useState(false)
  const [matchListId, setMatchListId] = useState<string>("")
  const [addedMissing, setAddedMissing] = useState<Set<number>>(new Set())
  const [generatingIdeas, setGeneratingIdeas] = useState(false)
  const [ideas, setIdeas] = useState<any[] | null>(null)
  const [showIdeas, setShowIdeas] = useState(false)
  const [ideaCookbooks, setIdeaCookbooks] = useState<any[]>([])
  const [savingIdeaFor, setSavingIdeaFor] = useState<string | null>(null)
  const [savedIdeas, setSavedIdeas] = useState<Set<string>>(new Set())
  const [customCategories, setCustomCategories] = useState<any[]>([])
  const [showNewCatModal, setShowNewCatModal] = useState(false)
  const [newCatName, setNewCatName] = useState("")
  const [editItem, setEditItem] = useState<any>(null)
  const [editName, setEditName] = useState("")
  const [editQty, setEditQty] = useState("")
  const [editCat, setEditCat] = useState("")
  const [editExpiry, setEditExpiry] = useState("")
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login?code=returning")
    if (status === "authenticated") {
      fetchInventory()
      fetchGroceryLists()
      fetchCustomCategories()
      fetch("/api/subscription").then(r => r.ok ? r.json() : null).then(d => d && setPlanStatus(d)).catch(() => {})
    }
  }, [status])

  async function fetchCustomCategories() {
    const res = await fetch("/api/inventory-categories")
    const data = await res.json()
    setCustomCategories(data.categories || [])
  }

  async function addCustomCategory() {
    if (!newCatName.trim()) return
    const res = await fetch("/api/inventory-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCatName.trim() }),
    })
    const data = await res.json()
    if (data.error) return toast.error(data.error)
    setNewCategory(newCatName.trim())
    setNewCatName("")
    setShowNewCatModal(false)
    fetchCustomCategories()
    toast.success("Category added!")
  }

  async function deleteCustomCategory(cat: any) {
    if (!confirm(`Delete the "${cat.name}" category?`)) return
    await fetch("/api/inventory-categories", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: cat.id }),
    })
    if (activeCategory === cat.name) setActiveCategory("All")
    if (newCategory === cat.name) setNewCategory("Pantry")
    fetchCustomCategories()
  }

  async function findRecipes() {
    setFinding(true)
    const res = await fetch("/api/what-can-i-make", { method: "POST" })
    const data = await res.json()
    setFinding(false)
    if (data.error === "limit_reached") return toast.info("You've used all your AI actions for this week.")
    if (data.error === "no_recipes") return toast.info("Add some recipes to your cookbooks first.")
    if (data.error === "no_inventory") return toast.info("Add items to your inventory first.")
    if (data.error) return toast.error("Something went wrong. Try again.")
    setMatches(data.results || [])
    setAddedMissing(new Set())
    setMatchListId(groceryLists[0]?.id?.toString() || "")
    setShowMatches(true)
  }

  async function generateIdeas() {
    setGeneratingIdeas(true)
    const res = await fetch("/api/inventory-suggest", { method: "POST" })
    const data = await res.json()
    setGeneratingIdeas(false)
    if (data.error === "limit_reached") return toast.info("You've used all your AI actions for this week.")
    if (data.error === "no_inventory") return toast.info("Add items to your inventory first.")
    if (data.error) return toast.error("Something went wrong. Try again.")
    setIdeas(data.results || [])
    setSavedIdeas(new Set())
    setShowIdeas(true)
    if (ideaCookbooks.length === 0) {
      const cbRes = await fetch("/api/cookbooks")
      const cbData = await cbRes.json()
      setIdeaCookbooks(cbData.cookbooks || [])
    }
  }

  async function saveIdea(idea: any, allowDuplicate = false) {
    let targetCookbookId = ideaCookbooks[0]?.id
    if (!targetCookbookId) {
      setSavingIdeaFor(idea.id)
      const cbRes = await fetch("/api/cookbooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "My Recipes", cover_emoji: "📖", cover_color: "#F97316" }),
      })
      const cbData = await cbRes.json()
      if (!cbData.id) { setSavingIdeaFor(null); toast.error("Could not create a cookbook. Try again."); return }
      targetCookbookId = cbData.id
      setIdeaCookbooks([{ id: cbData.id, title: "My Recipes" }])
    }
    setSavingIdeaFor(idea.id)
    const res = await fetch("/api/recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cookbook_id: targetCookbookId,
        title: idea.title,
        description: idea.description,
        ingredients: idea.ingredients,
        instructions: idea.instructions,
        prep_time: idea.prep_time,
        allow_duplicate: allowDuplicate,
        sort_order: 0,
      }),
    })
    if (res.status === 409) {
      setSavingIdeaFor(null)
      if (confirm(`You already have "${idea.title}" saved. Save it again anyway?`)) return saveIdea(idea, true)
      return
    }
    setSavingIdeaFor(null)
    if (!res.ok) return toast.error("Could not save this recipe. Try again.")
    setSavedIdeas(prev => new Set(prev).add(idea.id))
    toast.success("Saved to your cookbook!")
  }

  async function addMissingToList(match: any) {
    if (!matchListId || match.missing.length === 0) return
    await fetch("/api/grocery-lists", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: parseInt(matchListId), addItems: match.missing }),
    })
    setAddedMissing(prev => new Set(prev).add(match.id))
    toast.success(`Missing ingredients added to your list!`)
  }

  async function fetchInventory() {
    setLoading(true)
    const res = await fetch("/api/inventory")
    const data = await res.json()
    setItems(data.items || [])
    setLoading(false)
  }

  async function fetchGroceryLists() {
    const res = await fetch("/api/grocery-lists")
    const data = await res.json()
    setGroceryLists(data.lists || [])
  }

  async function addItem() {
    if (!newName.trim() || adding) return
    setAdding(true)
    await fetch("/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: [{ name: newName.trim(), quantity: newQty.trim(), category: newCategory }] }),
    })
    setNewName("")
    setNewQty("")
    await fetchInventory()
    setAdding(false)
    // Keep the flow going — focus back on the name field so you can keep typing
    nameInputRef.current?.focus()
  }

  function openEditItem(item: any) {
    setEditItem(item)
    setEditName(item.name || "")
    setEditQty(item.quantity || "")
    setEditCat(item.category || "Pantry")
    setEditExpiry(item.expires_at ? String(item.expires_at).slice(0, 10) : "")
  }

  function closeEditItem() {
    if (!editItem) return
    const dirty = editName !== (editItem.name || "") || editQty !== (editItem.quantity || "") || editCat !== (editItem.category || "Pantry") || editExpiry !== (editItem.expires_at ? String(editItem.expires_at).slice(0, 10) : "")
    if (dirty && !confirm("Discard your changes to this item?")) return
    setEditItem(null)
  }

  async function saveItemEdit() {
    if (!editItem || !editName.trim()) return
    const patch = { name: editName.trim(), quantity: editQty.trim(), category: editCat, expires_at: editExpiry || null }
    setItems(prev => prev.map(i => i.id === editItem.id ? { ...i, ...patch } : i))
    setEditItem(null)
    await fetch("/api/inventory", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editItem.id, ...patch }),
    })
    toast.success("Item updated!")
  }

  async function markUsed(id: number) {
    await fetch("/api/inventory", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, in_stock: 0 }),
    })
    setItems(prev => prev.map(i => i.id === id ? { ...i, in_stock: 0, used_at: new Date().toISOString() } : i))
  }

  async function markRestocked(id: number) {
    await fetch("/api/inventory", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, in_stock: 1 }),
    })
    setItems(prev => prev.map(i => i.id === id ? { ...i, in_stock: 1, used_at: null } : i))
  }

  async function deleteItem(id: number) {
    if (!confirm("Delete this item from your kitchen?")) return
    await fetch("/api/inventory", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
    setItems(prev => prev.filter(i => i.id !== id))
  }

  async function addToGroceryList() {
    if (!targetListId || !groceryItem) return
    await fetch("/api/grocery-lists", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: parseInt(targetListId),
        addItems: [groceryItem.quantity ? `${groceryItem.quantity} ${groceryItem.name}` : groceryItem.name],
      }),
    })
    setShowGroceryModal(false)
    setGroceryItem(null)
    setTargetListId("")
    toast.success("Added to grocery list!")
  }

  // Household items (toilet paper, soap...) never belong in the kitchen inventory
  function foodItemsOf(list: any) {
    return (list?.items || []).filter((i: any) => !i.is_household)
  }

  function openImportModal() {
    if (groceryLists.length === 0) return toast.info("You don't have any grocery lists yet.")
    const first = groceryLists[0]
    setSelectedList(first)
    setSelectedItems(new Set(foodItemsOf(first).map((i: any) => i.id)))
    setShowImportModal(true)
  }

  function onListChange(listId: string) {
    const list = groceryLists.find((l: any) => l.id === parseInt(listId))
    if (!list) return
    setSelectedList(list)
    setSelectedItems(new Set(foodItemsOf(list).map((i: any) => i.id)))
  }

  function toggleSelectItem(id: number) {
    setSelectedItems(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedItems.size === foodItemsOf(selectedList).length) {
      setSelectedItems(new Set())
    } else {
      setSelectedItems(new Set(foodItemsOf(selectedList).map((i: any) => i.id)))
    }
  }

  async function importFromGroceryList() {
    if (!selectedList || selectedItems.size === 0) return
    setImporting(true)
    const toImport = selectedList.items
      .filter((i: any) => selectedItems.has(i.id))
      .map((i: any) => {
        const skipPhrases = /^(as desired|as needed|to taste|to preference|as preferred)\s*/i
        const cleaned = i.ingredient.replace(skipPhrases, "").trim()
        const match = cleaned.match(/^([\d¼½¾⅓⅔⅛⅜⅝⅞\/\.\s]*\s*(tablespoons?|teaspoons?|cups?|tbsp|tsp|oz|lbs?|lb|g|kg|ml|l|cloves?|pieces?|slices?|cans?|whole)?\s*)/i)
        const qty = match?.[0]?.trim() || ""
        const name = cleaned.slice(qty.length).trim() || cleaned
        return { name: name || cleaned, quantity: qty, category: "Pantry" }
      })
    await fetch("/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: toImport }),
    })
    await fetchInventory()
    setImporting(false)
    setShowImportModal(false)
    setSelectedList(null)
    setSelectedItems(new Set())
  }

  const inStock = items.filter(i => i.in_stock === 1)
  const usedUp = items.filter(i => i.in_stock === 0)

  const filtered = activeCategory === "All"
    ? inStock
    : inStock.filter(i => i.category === activeCategory)

  // Defaults + user categories + anything items already use (e.g. deleted custom categories)
  const allCategories = Array.from(new Set([
    ...CATEGORIES,
    ...customCategories.map((c: any) => c.name),
    ...items.map(i => i.category).filter(Boolean),
  ]))

  const grouped = allCategories.reduce((acc: any, cat) => {
    const catItems = filtered.filter(i => i.category === cat)
    if (catItems.length > 0) acc[cat] = catItems
    return acc
  }, {})

  const expiringSoon = inStock
    .map(i => ({ item: i, expiry: expiryInfo(i.expires_at) }))
    .filter((x): x is { item: any; expiry: NonNullable<ReturnType<typeof expiryInfo>> } => !!x.expiry && x.expiry.days <= 3)
    .sort((a, b) => a.expiry.days - b.expiry.days)

  if (status === "loading") return <PageSkeleton />

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-10">

        <h1 className="text-2xl font-medium text-gray-900 mb-1">My Inventory</h1>
        <p className="text-sm text-gray-400 mb-6">What's in your kitchen right now.</p>

        {expiringSoon.length > 0 && (
          <div className="bg-white border border-amber-200 rounded-2xl p-4 mb-6">
            <div className="text-sm font-medium text-gray-900 flex items-center gap-1.5 mb-2.5"><ClockIcon size={14} className="text-amber-500" />Expiring soon</div>
            <div className="flex flex-wrap gap-2">
              {expiringSoon.map(({ item, expiry }) => (
                <button
                  key={item.id}
                  onClick={() => openEditItem(item)}
                  className={`text-xs font-medium rounded-full px-3 py-1.5 border transition hover:opacity-80 ${expiry.className}`}>
                  {item.name} · {expiry.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-white border border-gray-100 rounded-2xl p-4">
            <div className="text-2xl font-medium text-gray-900">{inStock.length}</div>
            <div className="text-xs text-gray-400 mt-1">Items in stock</div>
          </div>
          <div className="bg-white border border-gray-100 rounded-2xl p-4">
            <div className="text-2xl font-medium text-gray-900">{usedUp.length}</div>
            <div className="text-xs text-gray-400 mt-1">Used up</div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl p-5 flex items-center justify-between gap-4 mb-3">
          <div className="min-w-0">
            <div className="text-base font-semibold text-white flex items-center gap-2"><SparkleIcon size={16} />What can I make?</div>
            <div className="text-xs text-orange-50 mt-1">AI checks your kitchen against your cookbooks and finds recipes you can cook right now</div>
          </div>
          <button
            onClick={findRecipes}
            disabled={finding || inStock.length === 0 || (planStatus && !planStatus.canUseAI)}
            title={planStatus && !planStatus.canUseAI ? "AI limit reached for this week" : undefined}
            className="bg-white text-orange-600 px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-orange-50 transition whitespace-nowrap flex-shrink-0 disabled:opacity-60">
            {finding ? "Checking..." : "Find recipes"}
          </button>
        </div>

        <div className="bg-gradient-to-r from-violet-500 to-indigo-500 rounded-2xl p-5 flex items-center justify-between gap-4 mb-6">
          <div className="min-w-0">
            <div className="text-base font-semibold text-white flex items-center gap-2"><ChefIcon size={16} />Suggest something new</div>
            <div className="text-xs text-violet-50 mt-1">AI dreams up dishes from just what's in your kitchen — no cookbooks needed</div>
          </div>
          <button
            onClick={generateIdeas}
            disabled={generatingIdeas || inStock.length === 0 || (planStatus && !planStatus.canUseAI)}
            title={planStatus && !planStatus.canUseAI ? "AI limit reached for this week" : undefined}
            className="bg-white text-indigo-600 px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-indigo-50 transition whitespace-nowrap flex-shrink-0 disabled:opacity-60">
            {generatingIdeas ? "Thinking..." : "Surprise me"}
          </button>
        </div>

        <div className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center justify-between gap-4 mb-6">
          <div>
            <div className="text-sm font-medium text-gray-900">Import from a grocery list</div>
            <div className="text-xs text-gray-400 mt-0.5">Add everything from one of your saved lists at once</div>
          </div>
          <button
            onClick={openImportModal}
            className="border border-gray-200 text-gray-600 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 transition whitespace-nowrap flex-shrink-0">
            Choose a list →
          </button>
        </div>

        <div className="flex flex-col md:flex-row gap-2 mb-6">
          <input
            ref={nameInputRef}
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addItem()}
            enterKeyHint="done"
            placeholder='e.g. "2 lbs chicken breast" or just "milk"'
            className="w-full md:flex-1 min-w-0 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none bg-white"
          />
          <div className="flex gap-2">
            <input
              value={newQty}
              onChange={e => setNewQty(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addItem()}
              enterKeyHint="done"
              placeholder="Qty"
              className="w-20 flex-shrink-0 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none bg-white"
            />
            <select
              value={newCategory}
              onChange={e => setNewCategory(e.target.value)}
              className="flex-1 min-w-0 border border-gray-200 rounded-xl px-2 py-2.5 text-sm outline-none bg-white">
              {allCategories.map(c => <option key={c}>{c}</option>)}
            </select>
            <button
              onClick={() => setShowNewCatModal(true)}
              title="New category"
              className="w-11 flex-shrink-0 border border-gray-200 rounded-xl text-gray-400 hover:text-orange-500 hover:border-orange-200 transition text-lg leading-none bg-white">
              +
            </button>
            <button
              onClick={addItem}
              disabled={adding || !newName.trim()}
              className="bg-orange-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-orange-600 transition disabled:opacity-50 flex-shrink-0">
              {adding ? "..." : "Add"}
            </button>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap mb-6">
          {["All", ...allCategories].map(cat => {
            const custom = customCategories.find((c: any) => c.name === cat)
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`text-xs px-3 py-1.5 rounded-full border transition flex items-center gap-1.5 ${activeCategory === cat ? "bg-orange-500 text-white border-orange-500" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                {cat}
                {custom && (
                  <span
                    role="button"
                    onClick={e => { e.stopPropagation(); deleteCustomCategory(custom) }}
                    className={`leading-none ${activeCategory === cat ? "text-white/70 hover:text-white" : "text-gray-300 hover:text-red-400"}`}>
                    ×
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {loading ? (
          <div className="text-center py-16 text-sm text-gray-400">Loading inventory...</div>
        ) : inStock.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center p-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-300 mb-3"><ListIcon size={28} /></div>
            <p className="text-sm text-gray-500 font-medium mb-1">Your inventory is empty</p>
            <p className="text-xs text-gray-400">Add items above or import from a grocery list</p>
          </div>
        ) : Object.keys(grouped).length === 0 ? (
          <div className="text-center py-12 text-sm text-gray-400">No items in this category</div>
        ) : (
          <div className="space-y-8">
            {Object.entries(grouped).map(([cat, catItems]: any) => (
              <div key={cat}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-gray-400">{CATEGORY_ICONS[cat] || <ListIcon size={13} />}</span>
                  <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">{cat}</span>
                  <span className="text-xs text-gray-300">{catItems.length} items</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {catItems.map((item: any) => {
                    const expiry = expiryInfo(item.expires_at)
                    return (
                    <div key={item.id} className="bg-white border border-gray-100 rounded-2xl p-3 flex flex-col gap-1">
                      <div onClick={() => openEditItem(item)} className="text-sm font-medium text-gray-900 truncate cursor-pointer">{item.name}</div>
                      {item.quantity && <div className="text-xs text-gray-400">{item.quantity}</div>}
                      {expiry && <div className={`text-[10px] font-medium rounded-full px-2 py-0.5 border w-fit mt-0.5 ${expiry.className}`}>{expiry.label}</div>}
                      <div className="flex items-center justify-between mt-2">
                        <button
                          onClick={() => openEditItem(item)}
                          title="Edit name, quantity, or category"
                          className="text-xs text-gray-300 hover:text-orange-500 transition flex items-center gap-1">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg>
                          Edit
                        </button>
                        <button
                          onClick={() => markUsed(item.id)}
                          className="text-xs text-gray-300 hover:text-red-400 transition">
                          Used it ✕
                        </button>
                      </div>
                    </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {usedUp.length > 0 && (
          <div className="mt-10">
            <hr className="border-gray-100 mb-6" />
            <h2 className="text-base font-medium text-gray-900 mb-1">Used up</h2>
            <p className="text-xs text-gray-400 mb-4">Items auto-delete after 10 days — or remove them manually.</p>
            <div className="flex flex-col gap-2">
              {usedUp.map((item: any) => {
                const daysLeft = item.used_at ? daysUntilDelete(item.used_at) : 10
                const daysSince = item.used_at ? daysSinceUsed(item.used_at) : 0
                const isWarning = daysLeft <= 3
                return (
                  <div
                    key={item.id}
                    className={`bg-white border rounded-2xl px-4 py-3 flex items-center justify-between gap-4 ${isWarning ? "border-red-100" : "border-gray-100"}`}>
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{item.name}</div>
                      {isWarning ? (
                        <div className="text-xs text-red-400 font-medium">Deletes in {daysLeft} day{daysLeft !== 1 ? "s" : ""}</div>
                      ) : (
                        <div className="text-xs text-gray-400">Used {daysSince} day{daysSince !== 1 ? "s" : ""} ago</div>
                      )}
                    </div>
                    <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
                      <button
                        onClick={() => markRestocked(item.id)}
                        className="text-xs px-3 py-1.5 rounded-full bg-orange-50 text-orange-600 hover:bg-orange-100 transition">
                        Back in stock
                      </button>
                      <button
                        onClick={() => { setGroceryItem(item); setTargetListId(groceryLists[0]?.id?.toString() || ""); setShowGroceryModal(true) }}
                        className="text-xs px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition">
                        + Grocery list
                      </button>
                      <button
                        onClick={() => deleteItem(item.id)}
                        className="text-xs px-3 py-1.5 rounded-full bg-red-50 text-red-500 hover:bg-red-100 transition">
                        Delete
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

      </div>

      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-lg font-medium">Import from grocery list</h2>
              <button onClick={() => setShowImportModal(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <p className="text-xs text-gray-400 mb-4">Pick a list then select the items you want to add to your inventory.</p>
            <select
              onChange={e => onListChange(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none mb-4 w-full">
              {groceryLists.map((l: any) => (
                <option key={l.id} value={l.id}>{l.name} — {l.items?.length || 0} items</option>
              ))}
            </select>
            <div
              onClick={toggleSelectAll}
              className="flex items-center justify-between px-3 py-2.5 bg-gray-50 rounded-xl mb-2 cursor-pointer">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedItems.size === foodItemsOf(selectedList).length && foodItemsOf(selectedList).length > 0}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 accent-orange-500"
                  onClick={e => e.stopPropagation()}
                />
                Select all
              </label>
              <span className="text-xs text-gray-400">{selectedItems.size} of {foodItemsOf(selectedList).length} selected</span>
            </div>
            {(selectedList?.items || []).some((i: any) => i.is_household) && (
              <p className="text-xs text-blue-400 mb-2">Household items are left out — they don't belong in your kitchen inventory.</p>
            )}
            <div className="flex-1 overflow-y-auto space-y-0.5 mb-4">
              {foodItemsOf(selectedList).map((item: any) => (
                <div
                  key={item.id}
                  onClick={() => toggleSelectItem(item.id)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedItems.has(item.id)}
                    onChange={() => toggleSelectItem(item.id)}
                    className="w-4 h-4 accent-orange-500 flex-shrink-0"
                    onClick={e => e.stopPropagation()}
                  />
                  <span className="text-sm text-gray-900 flex-1">{item.ingredient}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowImportModal(false)} className="flex-1 border border-gray-200 rounded-xl py-2 text-sm text-gray-500 hover:bg-gray-50">Cancel</button>
              <button
                onClick={importFromGroceryList}
                disabled={importing || selectedItems.size === 0}
                className="flex-2 bg-orange-500 text-white rounded-xl py-2 px-4 text-sm font-medium hover:bg-orange-600 disabled:opacity-50">
                {importing ? "Importing..." : `Import ${selectedItems.size} item${selectedItems.size !== 1 ? "s" : ""} to inventory`}
              </button>
            </div>
          </div>
        </div>
      )}

      {showMatches && matches && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-md mx-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-base font-medium flex items-center gap-2"><SparkleIcon size={15} className="text-orange-500" />What you can make</h2>
                <p className="text-xs text-gray-400 mt-0.5">Based on {inStock.length} items in your kitchen</p>
              </div>
              <button onClick={() => setShowMatches(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {matches.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-10">No good matches right now — try adding more staples to your inventory.</p>
              )}
              {matches.map((m: any) => (
                <div key={m.id} className="border border-gray-100 rounded-2xl p-3">
                  <div className="flex items-center gap-3">
                    {m.image_url ? (
                      <img src={m.image_url} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center text-orange-300 flex-shrink-0"><PlateIcon size={22} /></div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{m.title}</div>
                      <div className="text-xs text-gray-400 truncate">{m.cookbook_title}{m.prep_time ? ` · ${m.prep_time}` : ""}</div>
                    </div>
                    {m.status === "ready" ? (
                      <span className="text-[10px] font-semibold text-green-600 bg-green-50 border border-green-100 rounded-full px-2.5 py-1 flex-shrink-0">✓ Ready</span>
                    ) : (
                      <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-100 rounded-full px-2.5 py-1 flex-shrink-0">Missing {m.missing.length}</span>
                    )}
                  </div>
                  {m.missing.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {m.missing.map((ing: string, i: number) => (
                        <span key={i} className="text-xs bg-gray-50 border border-gray-100 text-gray-500 rounded-full px-2.5 py-0.5">{ing}</span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-3">
                    <a
                      href={`/cookbook/${m.cookbook_id}?recipe=${m.id}`}
                      className="flex-1 text-center bg-orange-500 text-white rounded-xl py-2 text-xs font-semibold hover:bg-orange-600 transition">
                      Open recipe
                    </a>
                    {m.missing.length > 0 && groceryLists.length > 0 && (
                      <button
                        onClick={() => addMissingToList(m)}
                        disabled={addedMissing.has(m.id)}
                        className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2 text-xs font-semibold hover:bg-gray-50 transition disabled:opacity-60">
                        {addedMissing.has(m.id) ? "✓ Added to list" : "+ Missing to list"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {groceryLists.length > 1 && matches.some((m: any) => m.missing.length > 0) && (
              <div className="px-4 py-3 border-t border-gray-100 flex items-center gap-2">
                <span className="text-xs text-gray-400 flex-shrink-0">Add missing items to:</span>
                <select
                  value={matchListId}
                  onChange={e => setMatchListId(e.target.value)}
                  className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs outline-none">
                  {groceryLists.map((l: any) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {showIdeas && ideas && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-full max-w-md mx-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-base font-medium flex items-center gap-2"><ChefIcon size={15} className="text-indigo-500" />AI dish ideas</h2>
                <p className="text-xs text-gray-400 mt-0.5">Dreamed up from {inStock.length} items in your kitchen</p>
              </div>
              <button onClick={() => setShowIdeas(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {ideas.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-10">Couldn't come up with anything — try adding more to your inventory.</p>
              )}
              {ideas.map((idea: any) => (
                <div key={idea.id} className="border border-gray-100 rounded-2xl p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900">{idea.title}</div>
                      {idea.description && <div className="text-xs text-gray-400 mt-0.5">{idea.description}</div>}
                      {idea.prep_time && <div className="text-xs text-gray-400 mt-1 flex items-center gap-1"><ClockIcon size={11} />{idea.prep_time}</div>}
                    </div>
                    {idea.status === "ready" ? (
                      <span className="text-[10px] font-semibold text-green-600 bg-green-50 border border-green-100 rounded-full px-2.5 py-1 flex-shrink-0">✓ Ready</span>
                    ) : (
                      <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-100 rounded-full px-2.5 py-1 flex-shrink-0">Missing {idea.missing.length}</span>
                    )}
                  </div>
                  {idea.missing.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {idea.missing.map((ing: string, i: number) => (
                        <span key={i} className="text-xs bg-gray-50 border border-gray-100 text-gray-500 rounded-full px-2.5 py-0.5">{ing}</span>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => saveIdea(idea)}
                    disabled={savingIdeaFor === idea.id || savedIdeas.has(idea.id)}
                    className="w-full mt-3 bg-indigo-500 text-white rounded-xl py-2 text-xs font-semibold hover:bg-indigo-600 transition disabled:opacity-60">
                    {savedIdeas.has(idea.id) ? "✓ Saved to cookbook" : savingIdeaFor === idea.id ? "Saving..." : "Save this recipe"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {editItem && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50" onClick={() => closeEditItem()}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-medium mb-4">Edit item</h2>
            <label className="text-xs text-gray-500 mb-1 block">Name</label>
            <input
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && saveItemEdit()}
              autoFocus
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none mb-3"
            />
            <label className="text-xs text-gray-500 mb-1 block">Quantity <span className="text-gray-300">(optional)</span></label>
            <input
              value={editQty}
              onChange={e => setEditQty(e.target.value)}
              onKeyDown={e => e.key === "Enter" && saveItemEdit()}
              placeholder="e.g. 2 lbs"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none mb-3"
            />
            <label className="text-xs text-gray-500 mb-2 block">Category</label>
            <div className="flex flex-wrap gap-2 mb-5">
              {allCategories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setEditCat(cat)}
                  className={`text-sm px-4 py-2 rounded-full border transition ${editCat === cat ? "bg-orange-500 text-white border-orange-500" : "border-gray-200 text-gray-600 hover:bg-orange-50 hover:border-orange-200"}`}>
                  {cat}
                </button>
              ))}
            </div>
            <label className="text-xs text-gray-500 mb-1 block">Expires <span className="text-gray-300">(optional)</span></label>
            <div className="flex gap-2 mb-5">
              <input
                type="date"
                value={editExpiry}
                onChange={e => setEditExpiry(e.target.value)}
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none"
              />
              {editExpiry && (
                <button onClick={() => setEditExpiry("")} title="Clear" className="px-3 border border-gray-200 rounded-xl text-gray-400 hover:text-red-400 hover:border-red-200 transition">✕</button>
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={() => closeEditItem()} className="flex-1 border border-gray-200 rounded-xl py-2.5 text-sm text-gray-500 hover:bg-gray-50">Cancel</button>
              <button onClick={saveItemEdit} disabled={!editName.trim()} className="flex-1 bg-orange-500 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-orange-600 disabled:opacity-50">Save</button>
            </div>
          </div>
        </div>
      )}

      {showNewCatModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4">
            <h2 className="text-lg font-medium mb-1">New category</h2>
            <p className="text-sm text-gray-400 mb-4">Add your own inventory category, like "Baking" or "Drinks".</p>
            <input
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addCustomCategory()}
              placeholder="Category name"
              autoFocus
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none mb-4"
            />
            <div className="flex gap-3">
              <button onClick={() => { setShowNewCatModal(false); setNewCatName("") }} className="flex-1 border border-gray-200 rounded-xl py-2 text-sm text-gray-500 hover:bg-gray-50">Cancel</button>
              <button onClick={addCustomCategory} disabled={!newCatName.trim()} className="flex-1 bg-orange-500 text-white rounded-xl py-2 text-sm font-medium hover:bg-orange-600 disabled:opacity-50">Add</button>
            </div>
          </div>
        </div>
      )}

      {showGroceryModal && groceryItem && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4">
            <h2 className="text-lg font-medium mb-1">Add to grocery list</h2>
            <p className="text-sm text-gray-400 mb-4">Choose which list to add <span className="font-medium text-gray-700">{groceryItem.name}</span> to.</p>
            {groceryLists.length === 0 ? (
              <p className="text-sm text-gray-400 mb-4">You don't have any grocery lists yet.</p>
            ) : (
              <select
                value={targetListId}
                onChange={e => setTargetListId(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none mb-6">
                {groceryLists.map((l: any) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            )}
            <div className="flex gap-3">
              <button onClick={() => { setShowGroceryModal(false); setGroceryItem(null) }} className="flex-1 border border-gray-200 rounded-xl py-2 text-sm text-gray-500 hover:bg-gray-50">Cancel</button>
              <button onClick={addToGroceryList} disabled={!targetListId} className="flex-1 bg-orange-500 text-white rounded-xl py-2 text-sm font-medium hover:bg-orange-600 disabled:opacity-50">Add</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}