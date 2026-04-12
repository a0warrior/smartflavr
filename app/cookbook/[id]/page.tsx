"use client"
import { useEffect, useState, useRef } from "react"
import { useSession } from "next-auth/react"
import { useRouter, useParams } from "next/navigation"
import Navbar from "../../components/Navbar"
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

function SortableRecipeItem({ recipe, isSelected, onClick }: any) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: recipe.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div ref={setNodeRef} style={style} className={`mx-1 px-2 py-1.5 rounded-lg text-xs cursor-pointer flex items-center gap-1 ${isSelected ? "bg-orange-50 text-orange-700 font-medium" : "text-gray-500 hover:bg-gray-50"}`}>
      <span {...attributes} {...listeners} className="text-gray-300 cursor-grab text-xs mr-1">⠿</span>
      <span onClick={onClick} className="flex-1 truncate">{recipe.title}</span>
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
  const [cookMode, setCookMode] = useState(false)
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState("")
  const [search, setSearch] = useState("")
  const [edited, setEdited] = useState<any>(null)
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [newCatName, setNewCatName] = useState("")
  const [newCatEmoji, setNewCatEmoji] = useState("📋")
  const [scrollMode, setScrollMode] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [recipeToDelete, setRecipeToDelete] = useState<string | null>(null)
  const [isPublic, setIsPublic] = useState(false)
  const [cookbookInfo, setCookbookInfo] = useState<any>(null)
  const recipeRefs = useRef<any>({})

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login")
    if (status === "authenticated") {
      fetchRecipes()
      fetchCategories()
      fetchCookbookInfo()
    }
  }, [status])

  useEffect(() => {
    if (filteredRecipes.length > 0) {
      setSelectedRecipe(filteredRecipes[0])
    } else {
      setSelectedRecipe(null)
    }
  }, [activeCategory])

  async function fetchRecipes() {
    const res = await fetch(`/api/recipes?cookbook_id=${params.id}`)
    const data = await res.json()
    const sorted = (data.recipes || []).sort((a: any, b: any) => a.sort_order - b.sort_order)
    setRecipes(sorted)
    if (sorted.length > 0) setSelectedRecipe(sorted[0])
  }

  async function fetchCategories() {
    const res = await fetch(`/api/categories?cookbook_id=${params.id}`)
    const data = await res.json()
    setCategories(data.categories || [])
  }

  async function fetchCookbookInfo() {
    const res = await fetch(`/api/cookbooks/${params.id}`)
    const data = await res.json()
    if (data.cookbook) {
      setCookbookInfo(data.cookbook)
      setIsPublic(data.cookbook.is_public === 1)
    }
  }

  async function togglePublic() {
    const newValue = !isPublic
    setIsPublic(newValue)
    await fetch(`/api/cookbooks/${params.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: cookbookInfo?.title,
        cover_emoji: cookbookInfo?.cover_emoji,
        cover_color: cookbookInfo?.cover_color,
        cover_image: cookbookInfo?.cover_image || "",
        is_public: newValue ? 1 : 0,
      }),
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
  }

  async function createRecipe() {
    await fetch("/api/recipes", {
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
        sort_order: recipes.length,
      }),
    })
    await fetchRecipes()
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

  async function uploadPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = async () => {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: reader.result }),
      })
      const data = await res.json()
      if (data.success) {
        updateEdited("image_url", data.url)
      }
    }
    reader.readAsDataURL(file)
  }

  async function handleDragEnd(event: any) {
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

  function scrollToRecipe(id: string) {
    setSelectedRecipe(recipes.find(r => r.id === id))
    if (scrollMode && recipeRefs.current[id]) {
      recipeRefs.current[id].scrollIntoView({ behavior: "smooth" })
    }
  }

  const filteredRecipes = recipes.filter(r => {
    const matchesSearch = r.title.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = activeCategory === "all" || r.category_id == activeCategory
    return matchesSearch && matchesCategory
  })

  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  }

  const recipe = editMode ? edited : selectedRecipe

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="flex flex-1 overflow-hidden" style={{ height: "calc(100vh - 57px)" }}>

        <div className="w-52 bg-white border-r border-gray-100 flex flex-col overflow-hidden flex-shrink-0">
          <div className="p-3 border-b border-gray-100">
            <button onClick={() => router.push("/dashboard")} className="text-xs text-orange-500 mb-2 block">← Dashboard</button>
            <div className="text-sm font-medium">{cookbookInfo?.title || "My Cookbook"}</div>
            <div className="text-xs text-gray-400">{recipes.length} recipes</div>
          </div>
          <div className="p-2 border-b border-gray-100">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search recipes..." className="w-full bg-gray-50 border border-gray-100 rounded-lg px-2 py-1.5 text-xs"/>
          </div>
          <div className="px-2 pt-2 pb-1 text-xs font-medium text-gray-400 uppercase tracking-wide flex items-center justify-between">
            Categories
            <button onClick={() => setShowCategoryModal(true)} className="text-orange-400 font-normal normal-case text-xs">+ Add</button>
          </div>
          <div
            onClick={() => { setActiveCategory("all"); setSelectedRecipe(recipes[0] || null) }}
            className={`mx-1 px-2 py-1.5 rounded-lg text-xs cursor-pointer flex items-center gap-2 ${activeCategory === "all" ? "bg-orange-50 text-orange-700 font-medium" : "text-gray-500 hover:bg-gray-50"}`}>
            📋 All <span className="ml-auto text-gray-400">{recipes.length}</span>
          </div>
          {categories.map((cat: any) => {
            const count = recipes.filter(r => r.category_id == cat.id).length
            return (
              <div
                key={cat.id}
                onClick={() => { setActiveCategory(cat.id); setSelectedRecipe(null) }}
                className={`mx-1 px-2 py-1.5 rounded-lg text-xs cursor-pointer flex items-center gap-2 ${activeCategory === cat.id ? "bg-orange-50 text-orange-700 font-medium" : "text-gray-500 hover:bg-gray-50"}`}>
                {cat.emoji} {cat.name} <span className="ml-auto text-gray-400">{count}</span>
              </div>
            )
          })}
          <div className="px-2 pt-3 pb-1 text-xs font-medium text-gray-400 uppercase tracking-wide">Recipes</div>
          <div className="flex-1 overflow-y-auto">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={filteredRecipes.map(r => r.id)} strategy={verticalListSortingStrategy}>
                {filteredRecipes.map((r: any) => (
                  <SortableRecipeItem
                    key={r.id}
                    recipe={r}
                    isSelected={selectedRecipe?.id === r.id}
                    onClick={() => scrollToRecipe(r.id)}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>
          <div className="p-2 border-t border-gray-100">
            <button onClick={createRecipe} className="w-full bg-orange-500 text-white rounded-lg py-1.5 text-xs font-medium hover:bg-orange-600 transition">
              + Add Recipe
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
          <div className="bg-white border-b border-gray-100 px-4 py-2 flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${editMode ? "bg-orange-50 text-orange-700" : "bg-green-50 text-green-700"}`}>
              {editMode ? "Edit mode" : "Read mode"}
            </span>
            <div className="w-px h-4 bg-gray-100 mx-1"/>
            {!editMode && (
              <>
                <button onClick={() => setCookMode(!cookMode)} className={`px-3 py-1 border rounded-lg text-xs ${cookMode ? "bg-orange-500 text-white border-orange-500" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                  {cookMode ? "✓ Cook mode" : "Cook mode"}
                </button>
                <button onClick={() => setScrollMode(!scrollMode)} className={`px-3 py-1 border rounded-lg text-xs ${scrollMode ? "bg-orange-500 text-white border-orange-500" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                  {scrollMode ? "✓ Scroll mode" : "Scroll mode"}
                </button>
              </>
            )}
            {!editMode ? (
              <button onClick={startEdit} className="px-3 py-1 border border-orange-300 text-orange-500 rounded-lg text-xs hover:bg-orange-50">Edit</button>
            ) : (
              <>
                <button onClick={cancelEdit} className="px-3 py-1 border border-gray-200 text-gray-500 rounded-lg text-xs hover:bg-gray-50">Cancel</button>
                <button onClick={saveRecipe} disabled={saving} className="px-3 py-1 bg-orange-500 text-white rounded-lg text-xs font-medium hover:bg-orange-600">
                  {saving ? "Saving..." : "Save"}
                </button>
              </>
            )}
            {selectedRecipe && !editMode && (
              <button onClick={() => deleteRecipe(selectedRecipe.id)} className="px-3 py-1 border border-red-200 text-red-400 rounded-lg text-xs hover:bg-red-50 ml-1">Delete</button>
            )}
            <div className="ml-auto flex items-center gap-2">
  {isPublic && (
    <button
      onClick={() => {
        navigator.clipboard.writeText(`${window.location.origin}/share/cookbook/${params.id}`)
        alert("Link copied to clipboard!")
      }}
      className="px-3 py-1 border border-orange-200 text-orange-500 rounded-lg text-xs hover:bg-orange-50">
      Share ↗
    </button>
  )}
  <span className="text-xs text-gray-400">{lastSaved}</span>
</div>
          </div>

          <div className="flex-1 overflow-y-auto px-8 py-6" id="recipe-content">
            {scrollMode ? (
              filteredRecipes.map((r: any) => (
                <div key={r.id} ref={(el: any) => { recipeRefs.current[r.id] = el }} className="mb-16">
                  <h2 className="text-2xl font-medium mb-3">{r.title}</h2>
                  <div className="flex gap-2 mb-3 flex-wrap">
                    {r.prep_time && <span className="bg-gray-100 rounded-full px-3 py-1 text-xs text-gray-500">⏱ {r.prep_time}</span>}
                    {r.servings && <span className="bg-gray-100 rounded-full px-3 py-1 text-xs text-gray-500">👤 {r.servings}</span>}
                    {r.difficulty && <span className="bg-gray-100 rounded-full px-3 py-1 text-xs text-gray-500">★ {r.difficulty}</span>}
                  </div>
                  {r.description && <p className="text-sm text-gray-500 mb-4 leading-relaxed">{r.description}</p>}
                  <div className="rounded-xl mb-5 overflow-hidden">
                    {r.image_url ? (
                      <img src={r.image_url} className="w-full object-contain rounded-xl"/>
                    ) : (
                      <div className="border-2 border-dashed border-gray-100 rounded-xl h-32 flex items-center justify-center">
                        <span className="text-xs text-gray-400">📷 No photo</span>
                      </div>
                    )}
                  </div>
                  {r.ingredients && (
                    <div className="mb-5">
                      <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Ingredients</div>
                      {r.ingredients.split("\n").filter(Boolean).map((ing: string, i: number) => (
                        <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-50">
                          {cookMode && <input type="checkbox" className="w-3.5 h-3.5 accent-orange-500"/>}
                          <span className="text-sm">{ing}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {r.instructions && (
                    <div className="mb-5">
                      <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Instructions</div>
                      {r.instructions.split("\n").filter(Boolean).map((step: string, i: number) => (
                        <div key={i} className="flex gap-3 mb-3">
                          <div className="w-6 h-6 rounded-full bg-orange-50 text-orange-700 text-xs font-medium flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</div>
                          <p className="text-sm leading-relaxed flex-1">{step}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {r.notes && (
                    <div className="bg-amber-50 rounded-xl p-4 text-sm text-amber-800 leading-relaxed mb-4">
                      💡 {r.notes}
                    </div>
                  )}
                  <hr className="border-gray-100"/>
                </div>
              ))
            ) : recipe ? (
              <>
                {!editMode ? (
                  <>
                    <h1 className="text-2xl font-medium mb-3">{recipe.title}</h1>
                    <div className="flex gap-2 mb-3 flex-wrap">
                      {recipe.prep_time && <span className="bg-gray-100 rounded-full px-3 py-1 text-xs text-gray-500">⏱ {recipe.prep_time}</span>}
                      {recipe.servings && <span className="bg-gray-100 rounded-full px-3 py-1 text-xs text-gray-500">👤 {recipe.servings}</span>}
                      {recipe.difficulty && <span className="bg-gray-100 rounded-full px-3 py-1 text-xs text-gray-500">★ {recipe.difficulty}</span>}
                    </div>
                    {recipe.description && <p className="text-sm text-gray-500 mb-5 leading-relaxed">{recipe.description}</p>}
                    <div className="rounded-xl mb-6 overflow-hidden">
                      {recipe.image_url ? (
                        <img src={recipe.image_url} className="w-full object-contain rounded-xl"/>
                      ) : (
                        <div className="border-2 border-dashed border-gray-100 rounded-xl h-48 flex items-center justify-center cursor-pointer hover:bg-gray-50">
                          <span className="text-xs text-gray-400">📷 No photo yet — click Edit to add one</span>
                        </div>
                      )}
                    </div>
                    {recipe.ingredients && (
                      <div id="ingredients" className="mb-6">
                        <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Ingredients</div>
                        {recipe.ingredients.split("\n").filter(Boolean).map((ing: string, i: number) => (
                          <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-50">
                            {cookMode && <input type="checkbox" className="w-3.5 h-3.5 accent-orange-500 flex-shrink-0"/>}
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
                    {recipe.source_url && (
                      <a href={recipe.source_url} target="_blank" className="text-xs text-orange-500 mt-2 block">View original source ↗</a>
                    )}
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
                      <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Description</div>
                      <textarea value={edited.description || ""} onChange={e => updateEdited("description", e.target.value)} placeholder="Add a description..." className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none outline-none" rows={2}/>
                    </div>
                    <div className="mb-4">
                      <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Ingredients <span className="text-gray-300 font-normal normal-case">(one per line)</span></div>
                      <textarea value={edited.ingredients || ""} onChange={e => updateEdited("ingredients", e.target.value)} placeholder="200g pasta&#10;100g cheese&#10;Salt" className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none outline-none" rows={6}/>
                    </div>
                    <div className="mb-4">
                      <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Instructions <span className="text-gray-300 font-normal normal-case">(one step per line)</span></div>
                      <textarea value={edited.instructions || ""} onChange={e => updateEdited("instructions", e.target.value)} placeholder="Boil water&#10;Add pasta&#10;Drain and serve" className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none outline-none" rows={8}/>
                    </div>
                    <div className="mb-4">
                      <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Notes</div>
                      <textarea value={edited.notes || ""} onChange={e => updateEdited("notes", e.target.value)} placeholder="Tips, variations, substitutions..." className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none outline-none" rows={3}/>
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

          <div className="bg-white border-t border-gray-100 px-4 py-2 flex gap-2 overflow-x-auto">
            {["Top", "Ingredients", "Instructions", "Notes"].map(section => (
              <button key={section} onClick={() => {
                if (section === "Top") document.getElementById("recipe-content")?.scrollTo({ top: 0, behavior: "smooth" })
                else document.getElementById(section.toLowerCase())?.scrollIntoView({ behavior: "smooth" })
              }} className="px-3 py-1 rounded-full text-xs border border-gray-200 text-gray-500 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200 transition whitespace-nowrap flex-shrink-0">
                {section}
              </button>
            ))}
          </div>
        </div>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4">
            <h2 className="text-lg font-medium mb-2">Delete Recipe?</h2>
            <p className="text-sm text-gray-500 mb-6">This can't be undone. Are you sure you want to delete this recipe?</p>
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
    </div>
  )
}