import pool from "@/lib/db"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { auth } from "@/auth"

export default async function PublicCookbookPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [cookbooks]: any = await pool.query(
    "SELECT cookbooks.*, users.name as author_name, users.username as author_username, users.image as author_image, users.id as author_id FROM cookbooks LEFT JOIN users ON cookbooks.user_id = users.id WHERE cookbooks.id = ? AND cookbooks.is_public = 1",
    [id]
  )

  if (cookbooks.length === 0) notFound()

  const cookbook = cookbooks[0]

  const session = await auth()
  if (session?.user?.email) {
    const [sessionUser]: any = await pool.query(
      "SELECT id FROM users WHERE email = ?",
      [session.user.email]
    )
    if (sessionUser.length > 0 && sessionUser[0].id === cookbook.user_id) {
      redirect(`/cookbook/${id}`)
    }
  }

  const [recipes]: any = await pool.query(
    "SELECT * FROM recipes WHERE cookbook_id = ? ORDER BY sort_order ASC",
    [id]
  )

  const [categories]: any = await pool.query(
    "SELECT * FROM categories WHERE cookbook_id = ?",
    [id]
  )

  const previewRecipes = recipes.slice(0, 2)
  const remainingCount = recipes.length - 2

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo.svg" alt="SmartFlavr" width={36} height={36}/>
          <span className="text-lg font-medium">Smart<span className="text-orange-500">Flavr</span></span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href={`/login?code=returning&redirect=/share/cookbook/${id}`} className="text-sm text-gray-500 hover:text-gray-900">
            Sign in
          </Link>
          <Link href={`/?redirect=/share/cookbook/${id}`} className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition">
            Join SmartFlavr
          </Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-10">

        <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden mb-6">
          <div className="h-52 flex items-center justify-center overflow-hidden"
            style={{ backgroundColor: cookbook.cover_image ? "transparent" : cookbook.cover_color + "22" }}>
            {cookbook.cover_image ? (
              <img src={cookbook.cover_image} className="w-full h-full object-cover"/>
            ) : (
              <span className="text-7xl">{cookbook.cover_emoji}</span>
            )}
          </div>
          <div className="p-6">
            <h1 className="text-2xl font-medium mb-2">{cookbook.title}</h1>
            {cookbook.author_username && (
              <Link href={`/u/${cookbook.author_username}`} className="flex items-center gap-2 mt-2">
                <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center text-xs font-medium text-orange-600">
                  {cookbook.author_name?.charAt(0)}
                </div>
                <span className="text-sm text-gray-500">by {cookbook.author_name}</span>
              </Link>
            )}
            <div className="flex gap-6 mt-4">
              <div>
                <div className="text-lg font-medium">{recipes.length}</div>
                <div className="text-xs text-gray-400">Recipes</div>
              </div>
              <div>
                <div className="text-lg font-medium">{categories.length}</div>
                <div className="text-xs text-gray-400">Categories</div>
              </div>
            </div>
          </div>
        </div>

        {!session?.user && (
          <div className="bg-orange-50 border border-orange-100 rounded-2xl p-5 mb-8 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-orange-900 mb-1">Want to see all {recipes.length} recipes?</p>
              <p className="text-xs text-orange-700">Join SmartFlavr to view the full cookbook, save recipes, and create your own.</p>
            </div>
            <Link href={`/?redirect=/share/cookbook/${id}`} className="flex-shrink-0 bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-orange-600 transition">
              Get started →
            </Link>
          </div>
        )}

        <h2 className="text-lg font-medium mb-4">{session?.user ? "Recipes" : "Preview"}</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {(session?.user ? recipes : previewRecipes).map((recipe: any) => (
            <div key={recipe.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
              {recipe.image_url && (
                <div className="h-36 overflow-hidden">
                  <img src={recipe.image_url} className="w-full h-full object-cover"/>
                </div>
              )}
              <div className="p-5">
                <h3 className="font-medium text-gray-900 mb-2">{recipe.title}</h3>
                {recipe.description && (
                  <p className="text-sm text-gray-500 mb-3 leading-relaxed line-clamp-2">{recipe.description}</p>
                )}
                <div className="flex gap-3 text-xs text-gray-400">
                  {recipe.prep_time && <span>⏱ {recipe.prep_time}</span>}
                  {recipe.servings && <span>👤 {recipe.servings}</span>}
                  {recipe.difficulty && <span>★ {recipe.difficulty}</span>}
                </div>
                {recipe.ingredients && (
                  <div className="mt-4">
                    <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Ingredients</div>
                    {recipe.ingredients.split("\n").filter(Boolean).slice(0, session?.user ? 100 : 4).map((ing: string, i: number) => (
                      <div key={i} className="py-1.5 border-b border-gray-50 text-sm">{ing}</div>
                    ))}
                    {!session?.user && recipe.ingredients.split("\n").filter(Boolean).length > 4 && (
                      <p className="text-xs text-gray-400 mt-1">+ {recipe.ingredients.split("\n").filter(Boolean).length - 4} more ingredients</p>
                    )}
                  </div>
                )}
                {session?.user && recipe.instructions && (
                  <div className="mt-4">
                    <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Instructions</div>
                    {recipe.instructions.split("\n").filter(Boolean).map((step: string, i: number) => (
                      <div key={i} className="flex gap-3 mb-3">
                        <div className="w-5 h-5 rounded-full bg-orange-50 text-orange-700 text-xs font-medium flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</div>
                        <p className="text-sm leading-relaxed flex-1">{step}</p>
                      </div>
                    ))}
                  </div>
                )}
                {session?.user && recipe.notes && (
                  <div className="mt-4 bg-amber-50 rounded-xl p-3 text-sm text-amber-800">
                    💡 {recipe.notes}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {!session?.user && remainingCount > 0 && (
          <div className="relative">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-30 pointer-events-none select-none">
              {recipes.slice(2, 4).map((recipe: any) => (
                <div key={recipe.id} className="bg-white border border-gray-100 rounded-2xl p-5">
                  <h3 className="font-medium text-gray-900 mb-2">{recipe.title}</h3>
                  <div className="flex gap-3 text-xs text-gray-400">
                    {recipe.prep_time && <span>⏱ {recipe.prep_time}</span>}
                    {recipe.servings && <span>👤 {recipe.servings}</span>}
                  </div>
                </div>
              ))}
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-white border border-gray-100 rounded-2xl p-6 text-center shadow-sm">
                <p className="text-base font-medium text-gray-900 mb-1">+{remainingCount} more recipes</p>
                <p className="text-sm text-gray-500 mb-4">Join SmartFlavr to see the full cookbook</p>
                <Link href={`/?redirect=/share/cookbook/${id}`} className="inline-block bg-orange-500 text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-orange-600 transition">
                  Get started →
                </Link>
              </div>
            </div>
          </div>
        )}

        <div className="mt-12 text-center">
          <p className="text-xs text-gray-400">Shared via <Link href="/" className="text-orange-500">SmartFlavr</Link></p>
        </div>
      </div>
    </div>
  )
}