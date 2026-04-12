"use client"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import Navbar from "../components/Navbar"

export default function Dashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [cookbooks, setCookbooks] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [title, setTitle] = useState("")
  const [emoji, setEmoji] = useState("📖")
  const [loading, setLoading] = useState(false)
  const [url, setUrl] = useState("")
  const [extracting, setExtracting] = useState(false)
  const [extractedRecipe, setExtractedRecipe] = useState<any>(null)
  const [selectedCookbook, setSelectedCookbook] = useState("")

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
    if (status === "authenticated") fetchCookbooks()
  }, [status])

  async function fetchCookbooks() {
    const res = await fetch("/api/cookbooks")
    const data = await res.json()
    setCookbooks(data.cookbooks || [])
  }

  async function createCookbook() {
    if (!title) return
    setLoading(true)
    await fetch("/api/cookbooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, cover_emoji: emoji }),
    })
    setTitle("")
    setEmoji("📖")
    setShowModal(false)
    setLoading(false)
    fetchCookbooks()
  }

async function extractRecipe() {
  if (!url) return
  setExtracting(true)
  const res = await fetch("/api/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  })
  const data = await res.json()
  if (data.success) {
    setExtractedRecipe(data.recipe)
    setUrl("")
  } else {
    alert("Could not extract recipe. Try a different URL.")
  }
  setExtracting(false)
}

async function saveRecipe() {
  if (!selectedCookbook || !extractedRecipe) return
  await fetch("/api/recipes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...extractedRecipe,
      cookbook_id: selectedCookbook,
    }),
  })
  setExtractedRecipe(null)
  setSelectedCookbook("")
  alert("Recipe saved!")
}

  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-8">
  <p className="text-sm text-gray-500 mb-3">Extract a recipe from any URL</p>
  <div className="flex gap-3">
    <input
      value={url}
      onChange={e => setUrl(e.target.value)}
      placeholder="Paste a Pinterest or recipe URL..."
      className="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-sm"
    />
    <button
      onClick={extractRecipe}
      disabled={extracting}
      className="bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-orange-600 transition">
      {extracting ? "Extracting..." : "Extract"}
    </button>
  </div>
</div>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-medium text-gray-900">My Cookbooks</h1>
            <p className="text-gray-500 text-sm mt-1">Welcome back, {session?.user?.name?.split(" ")[0]}!</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-orange-600 transition">
            + New Cookbook
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {cookbooks.map((book: any) => (
            <div key={book.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden cursor-pointer hover:shadow-sm transition">
              <div className="h-24 flex items-center justify-center text-4xl" style={{ backgroundColor: book.cover_color + "22" }}>
                {book.cover_emoji}
              </div>
              <div className="p-3">
                <div className="font-medium text-sm text-gray-900">{book.title}</div>
              </div>
            </div>
          ))}
          <div
            onClick={() => setShowModal(true)}
            className="bg-white border border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center p-8 cursor-pointer hover:bg-gray-50 transition">
            <span className="text-3xl text-gray-300 mb-2">+</span>
            <span className="text-sm text-gray-400">New cookbook</span>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4">
            <h2 className="text-lg font-medium mb-4">New Cookbook</h2>
            <div className="mb-4">
              <label className="text-sm text-gray-500 mb-1 block">Emoji</label>
              <input
                value={emoji}
                onChange={e => setEmoji(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 w-20 text-center text-2xl"
              />
            </div>
            <div className="mb-6">
              <label className="text-sm text-gray-500 mb-1 block">Title</label>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Italian Classics"
                className="border border-gray-200 rounded-lg px-3 py-2 w-full text-sm"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 border border-gray-200 rounded-xl py-2 text-sm text-gray-500 hover:bg-gray-50 transition">
                Cancel
              </button>
              <button
                onClick={createCookbook}
                disabled={loading}
                className="flex-1 bg-orange-500 text-white rounded-xl py-2 text-sm font-medium hover:bg-orange-600 transition">
                {loading ? "Creating..." : "Create"}
              </button>
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
        <p className="text-sm text-gray-500 mb-1">Save to cookbook</p>
        <select
          value={selectedCookbook}
          onChange={e => setSelectedCookbook(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 w-full text-sm">
          <option value="">Select a cookbook...</option>
          {cookbooks.map((book: any) => (
            <option key={book.id} value={book.id}>{book.cover_emoji} {book.title}</option>
          ))}
        </select>
      </div>
      <div className="flex gap-3">
        <button
          onClick={() => setExtractedRecipe(null)}
          className="flex-1 border border-gray-200 rounded-xl py-2 text-sm text-gray-500 hover:bg-gray-50 transition">
          Discard
        </button>
        <button
          onClick={saveRecipe}
          disabled={!selectedCookbook}
          className="flex-1 bg-orange-500 text-white rounded-xl py-2 text-sm font-medium hover:bg-orange-600 transition disabled:opacity-50">
          Save Recipe
        </button>
      </div>
    </div>
  </div>
)}
    </div>
  )
}