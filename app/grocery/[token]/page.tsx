"use client"
import { useEffect, useState, useCallback } from "react"
import { subscribe, pulse } from "@/lib/firebase"
import Link from "next/link"

export default function SharedGroceryPage({ params }: { params: { token: string } }) {
  const [list, setList] = useState<any>(null)
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const fetchList = useCallback(async () => {
    try {
      const res = await fetch(`/api/grocery/${params.token}`)
      if (!res.ok) { setNotFound(true); setLoading(false); return }
      const data = await res.json()
      setList(data.list)
      setItems(data.items)
      setLoading(false)
    } catch {
      setNotFound(true)
      setLoading(false)
    }
  }, [params.token])

  useEffect(() => {
    fetchList()
    const unsub = subscribe(`updates/grocery/${params.token}`, fetchList)
    return unsub
  }, [params.token, fetchList])

  async function toggleItem(item: any) {
    const newChecked = !item.checked
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, checked: newChecked } : i))
    await fetch(`/api/grocery/${params.token}/check`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: item.id, checked: newChecked }),
    })
    pulse(`updates/grocery/${params.token}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-orange-300 border-t-orange-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-3 px-4">
        <p className="text-gray-500 text-sm">This grocery list is no longer shared.</p>
        <Link href="/" className="text-orange-500 text-sm hover:underline">Go to SmartFlavr</Link>
      </div>
    )
  }

  const unchecked = items.filter(i => !i.checked)
  const checked = items.filter(i => i.checked)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-8">

        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Grocery list</p>
            <h1 className="text-xl font-semibold text-gray-900">{list.name}</h1>
            <p className="text-sm text-gray-400">{unchecked.length} remaining · {checked.length} in cart</p>
          </div>
          <Link href="/" className="text-xs text-orange-500 font-medium hover:underline">SmartFlavr</Link>
        </div>

        <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
          {unchecked.length === 0 && checked.length === 0 && (
            <p className="px-4 py-6 text-sm text-gray-400 text-center">No items in this list.</p>
          )}

          {unchecked.map(item => (
            <button
              key={item.id}
              onClick={() => toggleItem(item)}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left border-b border-gray-50 hover:bg-gray-50 transition last:border-b-0">
              <div className="w-5 h-5 rounded border border-gray-300 flex-shrink-0" />
              <span className="text-sm text-gray-900">{item.ingredient}</span>
            </button>
          ))}

          {checked.length > 0 && (
            <>
              <div className="px-4 py-2 text-xs font-medium text-gray-400 uppercase tracking-wide bg-gray-50 border-t border-gray-100">
                In cart ({checked.length})
              </div>
              {checked.map(item => (
                <button
                  key={item.id}
                  onClick={() => toggleItem(item)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left border-b border-gray-50 hover:bg-gray-50 transition opacity-50 last:border-b-0">
                  <div className="w-5 h-5 rounded bg-orange-500 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs leading-none">✓</span>
                  </div>
                  <span className="text-sm line-through text-gray-400">{item.ingredient}</span>
                </button>
              ))}
            </>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">Updates in real time · Shared via SmartFlavr</p>
      </div>
    </div>
  )
}
