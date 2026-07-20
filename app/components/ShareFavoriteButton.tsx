"use client"
import { useEffect, useState } from "react"
import { HeartIcon } from "@/app/components/Icons"

// The share/recipe page is a server component with no session-bound
// favorite state pre-fetched — this client wrapper fetches/toggles it.
// Favoriting itself has never been restricted to your own recipes (the API
// has no ownership check); the button was just missing on this page, which
// is where most discovery flows (Explore, feed) actually land you.
export default function ShareFavoriteButton({ recipeId }: { recipeId: number }) {
  const [favorited, setFavorited] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch(`/api/favorites?recipe_id=${recipeId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setFavorited(!!d.favorited); setLoaded(true) })
      .catch(() => setLoaded(true))
  }, [recipeId])

  async function toggle() {
    const next = !favorited
    setFavorited(next)
    await fetch("/api/favorites", {
      method: next ? "POST" : "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipe_id: recipeId }),
    })
  }

  if (!loaded) return null

  return (
    <button
      onClick={toggle}
      title={favorited ? "Remove from favorites" : "Add to favorites"}
      className={`transition ${favorited ? "text-red-400" : "text-gray-300 hover:text-red-300"}`}>
      <HeartIcon filled={favorited} size={22} />
    </button>
  )
}
