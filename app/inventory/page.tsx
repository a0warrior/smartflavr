"use client"
import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import Navbar from "@/app/components/Navbar"

const CATEGORIES = ["Pantry", "Produce", "Proteins", "Dairy", "Frozen", "Spices"]

const CATEGORY_ICONS: Record<string, string> = {
  Pantry: "🧅",
  Produce: "🥦",
  Proteins: "🥩",
  Dairy: "🥛",
  Frozen: "🧊",
  Spices: "🌿",
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

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
    if (status === "authenticated") {
      fetchInventory()
      fetchGroceryLists()
    }
  }, [status])

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
    if (!newName.trim()) return
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
    alert("Added to grocery list!")
  }

  function openImportModal() {
    if (groceryLists.length === 0) return alert("You don't have any grocery lists yet.")
    const first = groceryLists[0]
    setSelectedList(first)
    setSelectedItems(new Set(first?.items?.map((i: any) => i.id) || []))
    setShowImportModal(true)
  }

  function onListChange(listId: string) {
    const list = groceryLists.find((l: any) => l.id === parseInt(listId))
    if (!list) return
    setSelectedList(list)
    setSelectedItems(new Set(list?.items?.map((i: any) => i.id) || []))
  }

  function toggleSelectItem(id: number) {
    setSelectedItems(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    if (selectedItems.size === selectedList?.items?.length) {
      setSelectedItems(new Set())
    } else {
      setSelectedItems(new Set(selectedList?.items?.map((i: any) => i.id) || []))
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

  const grouped = CATEGORIES.reduce((acc: any, cat) => {
    const catItems = filtered.filter(i => i.category === cat)
    if (catItems.length > 0) acc[cat] = catItems
    return acc
  }, {})

  if (status === "loading") return <div className="min-h-screen flex items-center justify-center">Loading...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-10">

        <h1 className="text-2xl font-medium text-gray-900 mb-1">My Inventory</h1>
        <p className="text-sm text-gray-400 mb-6">What's in your kitchen right now.</p>

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

        <div className="flex gap-2 mb-6 flex-wrap">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addItem()}
            placeholder='e.g. "2 lbs chicken breast" or just "milk"'
            className="flex-1 min-w-0 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none bg-white"
          />
          <input
            value={newQty}
            onChange={e => setNewQty(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addItem()}
            placeholder="Qty"
            className="w-24 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none bg-white"
          />
          <select
            value={newCategory}
            onChange={e => setNewCategory(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none bg-white">
            {CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
          <button
            onClick={addItem}
            disabled={adding || !newName.trim()}
            className="bg-orange-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-orange-600 transition disabled:opacity-50">
            {adding ? "Adding..." : "Add"}
          </button>
        </div>

        <div className="flex gap-2 flex-wrap mb-6">
          {["All", ...CATEGORIES].map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`text-xs px-3 py-1.5 rounded-full border transition ${activeCategory === cat ? "bg-orange-500 text-white border-orange-500" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
              {cat}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-16 text-sm text-gray-400">Loading inventory...</div>
        ) : inStock.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center p-16 text-center">
            <span className="text-4xl mb-3">🧺</span>
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
                  <span className="text-sm">{CATEGORY_ICONS[cat]}</span>
                  <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">{cat}</span>
                  <span className="text-xs text-gray-300">{catItems.length} items</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {catItems.map((item: any) => (
                    <div key={item.id} className="bg-white border border-gray-100 rounded-2xl p-3 flex flex-col gap-1">
                      <div className="text-sm font-medium text-gray-900 truncate">{item.name}</div>
                      {item.quantity && <div className="text-xs text-gray-400">{item.quantity}</div>}
                      <div className="flex justify-end mt-2">
                        <button
                          onClick={() => markUsed(item.id)}
                          className="text-xs text-gray-300 hover:text-red-400 transition">
                          Used it ✕
                        </button>
                      </div>
                    </div>
                  ))}
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
                        className="text-xs px-3 py-1.5 rounded-full bg-green-50 text-green-700 hover:bg-green-100 transition">
                        Back in stock
                      </button>
                      <button
                        onClick={() => { setGroceryItem(item); setTargetListId(groceryLists[0]?.id?.toString() || ""); setShowGroceryModal(true) }}
                        className="text-xs px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 transition">
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
                  checked={selectedItems.size === selectedList?.items?.length && selectedList?.items?.length > 0}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 accent-orange-500"
                  onClick={e => e.stopPropagation()}
                />
                Select all
              </label>
              <span className="text-xs text-gray-400">{selectedItems.size} of {selectedList?.items?.length || 0} selected</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-0.5 mb-4">
              {selectedList?.items?.map((item: any) => (
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