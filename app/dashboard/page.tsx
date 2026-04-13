"use client"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import Navbar from "../components/Navbar"
import ImageCropper from "../components/ImageCropper"

const COLORS = [
  "#F97316", "#EF4444", "#8B5CF6", "#3B82F6",
  "#10B981", "#F59E0B", "#EC4899", "#6366F1",
  "#14B8A6", "#84CC16"
]

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

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login?code=returning")
    if (status === "authenticated") {
      registerUser()
    }
  }, [status])

  async function registerUser() {
    const urlParams = new URLSearchParams(window.location.search)
    let code = urlParams.get("code")

    if (!code) {
      code = localStorage.getItem("pendingInviteCode")
    }

    if (code && code !== "" && code !== "returning") {
      await fetch("/api/invite", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          email: session?.user?.email,
          name: session?.user?.name,
          image: session?.user?.image,
        }),
      })
      localStorage.removeItem("pendingInviteCode")
      router.push("/profile/settings?new=true")
      return
    }

    const res = await fetch("/api/profile")
    const data = await res.json()
    if (!data.user?.username) {
      router.push("/profile/settings?new=true")
      return
    }

    fetchCookbooks()
  }

  async function fetchCookbooks() {
    const res = await fetch("/api/cookbooks")
    const data = await res.json()
    setCookbooks(data.cookbooks || [])
    setCollaboratedCookbooks(data.collaborated || [])
  }

  async function uploadCoverImage(e: React.ChangeEvent<HTMLInputElement>, isEdit = false) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => {
      setCropImage(reader.result as string)
      setCropTarget(isEdit ? "edit" : "new")
    }
    reader.readAsDataURL(file)
  }

  async function handleCropDone(cropped: string) {
    const res = await fetch("/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: cropped }),
    })
    const data = await res.json()
    if (data.success) {
      if (cropTarget === "edit") {
        setEditingCookbook((prev: any) => ({ ...prev, cover_image: data.url }))
      } else {
        setCoverImage(data.url)
      }
    }
    setCropImage("")
  }

  async function createCookbook() {
    if (!title) return
    setLoading(true)
    await fetch("/api/cookbooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, cover_emoji: emoji, cover_color: color, cover_image: coverImage }),
    })
    setTitle("")
    setEmoji("📖")
    setColor("#F97316")
    setCoverImage("")
    setShowModal(false)
    setLoading(false)
    fetchCookbooks()
  }

  async function updateCookbook() {
    if (!editingCookbook) return
    setLoading(true)
    await fetch(`/api/cookbooks/${editingCookbook.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editingCookbook.title,
        cover_emoji: editingCookbook.cover_emoji,
        cover_color: editingCookbook.cover_color,
        cover_image: editingCookbook.cover_image || "",
        is_public: editingCookbook.is_public ?? 0,
      }),
    })
    setShowEditModal(false)
    setEditingCookbook(null)
    setLoading(false)
    fetchCookbooks()
  }

  async function deleteCookbook(id: string) {
    if (!confirm("Delete this cookbook and all its recipes?")) return
    await fetch(`/api/cookbooks/${id}`, { method: "DELETE" })
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

  async function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setShowImportModal(true)
    setImportedRecipes([])
    setImportCookbooks({})

    if (file.type.startsWith("image/")) {
      const reader = new FileReader()
      reader.onloadend = async () => {
        const res = await fetch("/api/extract-file", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: reader.result, type: "image" }),
        })
        const data = await res.json()
        if (data.success) setImportedRecipes(data.recipes)
        else alert("Could not extract recipe from image.")
        setImporting(false)
      }
      reader.readAsDataURL(file)
    } else if (file.type === "application/pdf") {
      const reader = new FileReader()
      reader.onloadend = async () => {
        const res = await fetch("/api/extract-file", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: reader.result, type: "image" }),
        })
        const data = await res.json()
        if (data.success) setImportedRecipes(data.recipes)
        else alert("Could not extract recipe from PDF.")
        setImporting(false)
      }
      reader.readAsDataURL(file)
    } else {
      const text = await file.text()
      const res = await fetch("/api/extract-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, type: "text" }),
      })
      const data = await res.json()
      if (data.success) setImportedRecipes(data.recipes)
      else alert("Could not extract recipe from file.")
      setImporting(false)
    }
  }

  function toggleImportCookbook(recipeIndex: number, cookbookId: string) {
    setImportCookbooks(prev => {
      const current = prev[recipeIndex] || []
      if (current.includes(cookbookId)) {
        return { ...prev, [recipeIndex]: current.filter(id => id !== cookbookId) }
      } else {
        return { ...prev, [recipeIndex]: [...current, cookbookId] }
      }
    })
  }

  async function saveImportedRecipes() {
    if (importedRecipes.length === 0) return
    let saved = 0
    for (let i = 0; i < importedRecipes.length; i++) {
      const cookbookIds = importCookbooks[i] || []
      for (const cookbookId of cookbookIds) {
        await fetch("/api/recipes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...importedRecipes[i], cookbook_id: cookbookId }),
        })
        saved++
      }
    }
    setShowImportModal(false)
    setImportedRecipes([])
    setImportCookbooks({})
    alert(`Saved ${saved} recipe${saved !== 1 ? "s" : ""}!`)
  }

  async function saveRecipe() {
    if (selectedCookbooks.length === 0 || !extractedRecipe) return
    for (const cookbookId of selectedCookbooks) {
      await fetch("/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...extractedRecipe, cookbook_id: cookbookId }),
      })
    }
    setExtractedRecipe(null)
    setSelectedCookbooks([])
    alert(`Recipe saved to ${selectedCookbooks.length} cookbook${selectedCookbooks.length > 1 ? "s" : ""}!`)
  }

  function toggleCookbook(id: string) {
    setSelectedCookbooks(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    )
  }

  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-8">
          <p className="text-sm text-gray-500 mb-3">Extract a recipe from any URL or file</p>
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
            <button
              onClick={() => document.getElementById("file-import")?.click()}
              className="border border-gray-200 text-gray-500 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-50 transition">
              📷 Import file
            </button>
            <input
              type="file"
              id="file-import"
              accept="image/*,.pdf,.txt"
              onChange={handleFileImport}
              className="hidden"
            />
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
            <div key={book.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden cursor-pointer hover:shadow-sm transition group relative">
              <div
                onClick={() => router.push(`/cookbook/${book.id}`)}
                className="h-24 flex items-center justify-center overflow-hidden"
                style={{ backgroundColor: book.cover_image ? "transparent" : book.cover_color + "22" }}>
                {book.cover_image ? (
                  <img src={book.cover_image} className="w-full h-full object-cover"/>
                ) : (
                  <span className="text-4xl">{book.cover_emoji}</span>
                )}
              </div>
              <div className="p-3 flex items-center justify-between">
                <div
                  onClick={() => router.push(`/cookbook/${book.id}`)}
                  className="font-medium text-sm text-gray-900 flex-1 truncate">
                  {book.title}
                </div>
                <div className="flex items-center gap-1">
                  {book.is_public === 1 && (
                    <span className="text-xs text-green-500 font-medium">Public</span>
                  )}
                  <button
                    onClick={e => {
                      e.stopPropagation()
                      setEditingCookbook({ ...book })
                      setShowEditModal(true)
                    }}
                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 text-xs px-2 transition">
                    ✏️
                  </button>
                </div>
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

        {collaboratedCookbooks.length > 0 && (
          <div className="mt-10">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Shared with me</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {collaboratedCookbooks.map((book: any) => (
                <div
                  key={book.id}
                  onClick={() => router.push(`/cookbook/${book.id}`)}
                  className="bg-white border border-gray-100 rounded-2xl overflow-hidden cursor-pointer hover:shadow-sm transition">
                  <div
                    className="h-24 flex items-center justify-center overflow-hidden"
                    style={{ backgroundColor: book.cover_image ? "transparent" : book.cover_color + "22" }}>
                    {book.cover_image ? (
                      <img src={book.cover_image} className="w-full h-full object-cover"/>
                    ) : (
                      <span className="text-4xl">{book.cover_emoji}</span>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="font-medium text-sm text-gray-900 truncate">{book.title}</div>
                    <div className="flex items-center gap-1 mt-1">
                      {book.owner_image ? (
                        <img src={book.owner_image} className="w-4 h-4 rounded-full object-cover"/>
                      ) : (
                        <div className="w-4 h-4 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs">
                          {book.owner_name?.charAt(0)}
                        </div>
                      )}
                      <span className="text-xs text-gray-400">{book.owner_name}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

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
              <div
                onClick={() => document.getElementById("cover-upload-new")?.click()}
                className="border-2 border-dashed border-gray-100 rounded-xl h-24 flex items-center justify-center cursor-pointer hover:bg-gray-50 overflow-hidden">
                {coverImage ? (
                  <img src={coverImage} className="w-full h-full object-cover rounded-xl"/>
                ) : (
                  <span className="text-xs text-gray-400">📷 Click to add cover photo</span>
                )}
              </div>
              <input type="file" id="cover-upload-new" accept="image/*" onChange={e => uploadCoverImage(e, false)} className="hidden"/>
              {coverImage && (
                <button onClick={() => setCoverImage("")} className="text-xs text-red-400 mt-1">Remove image</button>
              )}
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
                    {COLORS.map(c => (
                      <div key={c} onClick={() => setColor(c)} className="w-7 h-7 rounded-full cursor-pointer" style={{ backgroundColor: c, outline: color === c ? `3px solid ${c}` : "none", outlineOffset: "2px" }}/>
                    ))}
                  </div>
                </div>
              </>
            )}
            <div className="mb-6">
              <label className="text-sm text-gray-500 mb-2 block">Visibility</label>
              <div className="flex gap-3">
                <button className="flex-1 py-2 rounded-xl text-sm border bg-gray-900 text-white border-gray-900">
                  🔒 Private
                </button>
                <button className="flex-1 py-2 rounded-xl text-sm border border-gray-200 text-gray-500 hover:bg-gray-50">
                  🌍 Public
                </button>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 border border-gray-200 rounded-xl py-2 text-sm text-gray-500 hover:bg-gray-50">Cancel</button>
              <button onClick={createCookbook} disabled={loading} className="flex-1 bg-orange-500 text-white rounded-xl py-2 text-sm font-medium hover:bg-orange-600">
                {loading ? "Creating..." : "Create"}
              </button>
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
              <input
                value={editingCookbook.title}
                onChange={e => setEditingCookbook({ ...editingCookbook, title: e.target.value })}
                className="border border-gray-200 rounded-lg px-3 py-2 w-full text-sm"/>
            </div>
            <div className="mb-4">
              <label className="text-sm text-gray-500 mb-1 block">Cover image (optional)</label>
              <div
                onClick={() => document.getElementById("cover-upload-edit")?.click()}
                className="border-2 border-dashed border-gray-100 rounded-xl h-24 flex items-center justify-center cursor-pointer hover:bg-gray-50 overflow-hidden">
                {editingCookbook.cover_image ? (
                  <img src={editingCookbook.cover_image} className="w-full h-full object-cover rounded-xl"/>
                ) : (
                  <span className="text-xs text-gray-400">📷 Click to add cover photo</span>
                )}
              </div>
              <input type="file" id="cover-upload-edit" accept="image/*" onChange={e => uploadCoverImage(e, true)} className="hidden"/>
              {editingCookbook.cover_image && (
                <button onClick={() => setEditingCookbook({ ...editingCookbook, cover_image: "" })} className="text-xs text-red-400 mt-1">Remove image</button>
              )}
            </div>
            {!editingCookbook.cover_image && (
              <>
                <div className="mb-4">
                  <label className="text-sm text-gray-500 mb-1 block">Emoji</label>
                  <input
                    value={editingCookbook.cover_emoji}
                    onChange={e => setEditingCookbook({ ...editingCookbook, cover_emoji: e.target.value })}
                    className="border border-gray-200 rounded-lg px-3 py-2 w-20 text-center text-2xl"/>
                </div>
                <div className="mb-4">
                  <label className="text-sm text-gray-500 mb-2 block">Cover color</label>
                  <div className="flex gap-2 flex-wrap">
                    {COLORS.map(c => (
                      <div key={c} onClick={() => setEditingCookbook({ ...editingCookbook, cover_color: c })} className="w-7 h-7 rounded-full cursor-pointer" style={{ backgroundColor: c, outline: editingCookbook.cover_color === c ? `3px solid ${c}` : "none", outlineOffset: "2px" }}/>
                    ))}
                  </div>
                </div>
              </>
            )}
            <div className="mb-6">
              <label className="text-sm text-gray-500 mb-2 block">Visibility</label>
              <div className="flex gap-3">
                <button
                  onClick={() => setEditingCookbook({ ...editingCookbook, is_public: 0 })}
                  className={`flex-1 py-2 rounded-xl text-sm border transition ${editingCookbook.is_public === 0 || !editingCookbook.is_public ? "bg-gray-900 text-white border-gray-900" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                  🔒 Private
                </button>
                <button
                  onClick={() => setEditingCookbook({ ...editingCookbook, is_public: 1 })}
                  className={`flex-1 py-2 rounded-xl text-sm border transition ${editingCookbook.is_public === 1 ? "bg-green-500 text-white border-green-500" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                  🌍 Public
                </button>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => deleteCookbook(editingCookbook.id)} className="px-4 py-2 border border-red-200 text-red-400 rounded-xl text-sm hover:bg-red-50">Delete</button>
              <button onClick={() => setShowEditModal(false)} className="flex-1 border border-gray-200 rounded-xl py-2 text-sm text-gray-500 hover:bg-gray-50">Cancel</button>
              <button onClick={updateCookbook} disabled={loading} className="flex-1 bg-orange-500 text-white rounded-xl py-2 text-sm font-medium hover:bg-orange-600">
                {loading ? "Saving..." : "Save"}
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
              <p className="text-sm text-gray-500 mb-2">Save to cookbook(s)</p>
              <div className="space-y-2">
                {cookbooks.map((book: any) => (
                  <label key={book.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedCookbooks.includes(book.id)}
                      onChange={() => toggleCookbook(book.id)}
                      className="w-4 h-4 accent-orange-500"
                    />
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
                <button
                  onClick={() => setShowImportModal(false)}
                  className="mt-4 border border-gray-200 rounded-xl px-4 py-2 text-sm text-gray-500 hover:bg-gray-50">
                  Close
                </button>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-500 mb-4">
                  Found {importedRecipes.length} recipe{importedRecipes.length > 1 ? "s" : ""}! Select which cookbooks to save each to.
                </p>
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
                            <input
                              type="checkbox"
                              checked={(importCookbooks[i] || []).includes(book.id)}
                              onChange={() => toggleImportCookbook(i, book.id)}
                              className="w-3.5 h-3.5 accent-orange-500"
                            />
                            <span className="text-xs">{book.cover_emoji} {book.title}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => { setShowImportModal(false); setImportedRecipes([]); setImportCookbooks({}) }}
                    className="flex-1 border border-gray-200 rounded-xl py-2 text-sm text-gray-500 hover:bg-gray-50">
                    Cancel
                  </button>
                  <button
                    onClick={saveImportedRecipes}
                    disabled={Object.values(importCookbooks).every(v => v.length === 0)}
                    className="flex-1 bg-orange-500 text-white rounded-xl py-2 text-sm font-medium hover:bg-orange-600 disabled:opacity-50">
                    Save {Object.values(importCookbooks).flat().length} to cookbook{Object.values(importCookbooks).flat().length !== 1 ? "s" : ""}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {cropImage && (
        <ImageCropper
          image={cropImage}
          aspect={16 / 9}
          onCrop={handleCropDone}
          onCancel={() => setCropImage("")}
        />
      )}
    </div>
  )
}