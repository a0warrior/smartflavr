"use client"
import { useState } from "react"
import CookingMode from "@/app/components/CookingMode"

// The share/recipe page is a server component — this wrapper gives it a
// client-side "Start cooking" button that mounts the full CookingMode overlay.
export default function ShareCookButton({ recipe }: { recipe: any }) {
  const [cooking, setCooking] = useState(false)
  if (!recipe?.instructions) return null
  return (
    <>
      <button
        onClick={() => setCooking(true)}
        className="w-full flex items-center justify-center gap-2 bg-orange-500 text-white px-6 py-3 rounded-2xl text-sm font-semibold hover:bg-orange-600 active:scale-[0.99] transition mb-6">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>
        Start cooking
      </button>
      {cooking && <CookingMode recipes={[recipe]} onClose={() => setCooking(false)} />}
    </>
  )
}
