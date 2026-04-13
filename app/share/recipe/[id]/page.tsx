import pool from "@/lib/db"
import { notFound, redirect } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { auth } from "@/auth"

export default async function ShareRecipePage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [recipes]: any = await pool.query(
    `SELECT recipes.*, users.name as author_name, users.username as author_username,
     users.profile_image as author_image, cookbooks.title as cookbook_title,
     cookbooks.id as cookbook_id, cookbooks.is_public as cookbook_is_public
     FROM recipes
     LEFT JOIN users ON recipes.user_id = users.id
     LEFT JOIN cookbooks ON recipes.cookbook_id = cookbooks.id
     WHERE recipes.id = ?`,
    [id]
  )

  if (recipes.length === 0) notFound()

  const recipe = recipes[0]

  const session = await auth()
  if (session?.user?.email) {
    redirect(`/cookbook/${recipe.cookbook_id}?recipe=${recipe.id}`)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo.svg" alt="SmartFlavr" width={36} height={36}/>
          <span className="text-lg font-medium">Smart<span className="text-orange-500">Flavr</span></span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/login?code=returning" className="text-sm text-gray-500 hover:text-gray-900">
            Sign in
          </Link>
          <Link href="/" className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition">
            Join SmartFlavr
          </Link>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-10">
        {recipe.image_url && (
          <div className="rounded-2xl overflow-hidden mb-6">
            <img src={recipe.image_url} className="w-full object-contain"/>
          </div>
        )}

        <div className="bg-white border border-gray-100 rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Link href={`/u/${recipe.author_username}`} className="flex items-center gap-2">
              {recipe.author_image ? (
                <img src={recipe.author_image} className="w-6 h-6 rounded-full object-cover"/>
              ) : (
                <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs">
                  {recipe.author_name?.charAt(0)}
                </div>
              )}
              <span className="text-xs text-gray-500">{recipe.author_name}</span>
            </Link>
            <span className="text-xs text-gray-300">·</span>
            <span className="text-xs text-gray-400">from {recipe.cookbook_title}</span>
          </div>

          <h1 className="text-2xl font-medium mb-3">{recipe.title}</h1>

          <div className="flex gap-2 mb-4 flex-wrap">
            {recipe.prep_time && <span className="bg-gray-100 rounded-full px-3 py-1 text-xs text-gray-500">⏱ {recipe.prep_time}</span>}
            {recipe.servings && <span className="bg-gray-100 rounded-full px-3 py-1 text-xs text-gray-500">👤 {recipe.servings}</span>}
            {recipe.difficulty && <span className="bg-gray-100 rounded-full px-3 py-1 text-xs text-gray-500">★ {recipe.difficulty}</span>}
          </div>

          {recipe.description && (
            <p className="text-sm text-gray-500 leading-relaxed mb-6">{recipe.description}</p>
          )}

          {recipe.ingredients && (
            <div className="mb-6">
              <div className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Ingredients</div>
              {recipe.ingredients.split("\n").filter(Boolean).map((ing: string, i: number) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-50">
                  <span className="text-sm">{ing}</span>
                </div>
              ))}
            </div>
          )}

          {recipe.instructions && (
            <div className="mb-6">
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
            <div className="bg-amber-50 rounded-xl p-4 text-sm text-amber-800 leading-relaxed">
              💡 {recipe.notes}
            </div>
          )}
        </div>

        <div className="bg-orange-50 border border-orange-100 rounded-2xl p-5 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-orange-900 mb-1">Want to save this recipe?</p>
            <p className="text-xs text-orange-700">Join SmartFlavr to save recipes, create cookbooks and share with friends.</p>
          </div>
          <Link href="/" className="flex-shrink-0 bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-orange-600 transition">
            Get started →
          </Link>
        </div>

        <div className="mt-8 text-center">
          <p className="text-xs text-gray-400">Shared via <Link href="/" className="text-orange-500">SmartFlavr</Link></p>
        </div>
      </div>
    </div>
  )
}