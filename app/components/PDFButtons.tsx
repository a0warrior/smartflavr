"use client"
import { useState } from "react"
import { pdf } from "@react-pdf/renderer"
import { RecipeDocument, CookbookDocument } from "./RecipePDF"
import React from "react"

export function RecipePDFButton({ recipe }: { recipe: any }) {
  const [loading, setLoading] = useState(false)

  async function download() {
    setLoading(true)
    try {
      const blob = await pdf(React.createElement(RecipeDocument, { recipe })).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${recipe.title.replace(/[^a-z0-9]/gi, "-")}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={download}
      disabled={loading}
      className="px-3 py-1.5 border border-gray-200 text-gray-500 rounded-lg text-xs hover:bg-gray-50 transition disabled:opacity-50 flex items-center gap-1.5"
    >
      {loading ? (
        <>
          <svg className="animate-spin w-3 h-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          Generating...
        </>
      ) : "📄 Export PDF"}
    </button>
  )
}

export function CookbookPDFButton({ cookbook, recipes, authorName }: { cookbook: any; recipes: any[]; authorName: string }) {
  const [loading, setLoading] = useState(false)

  async function download() {
    setLoading(true)
    try {
      const blob = await pdf(React.createElement(CookbookDocument, { cookbook, recipes, authorName })).toBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${cookbook.title.replace(/[^a-z0-9]/gi, "-")}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={download}
      disabled={loading}
      className="px-3 py-1.5 border border-gray-200 text-gray-500 rounded-lg text-xs hover:bg-gray-50 transition disabled:opacity-50 flex items-center gap-1.5"
    >
      {loading ? (
        <>
          <svg className="animate-spin w-3 h-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
          </svg>
          Generating...
        </>
      ) : "📚 Export cookbook"}
    </button>
  )
}
