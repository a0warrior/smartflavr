"use client"
import { createContext, useCallback, useContext, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { toast } from "@/app/components/Toast"

// Recipe extraction (URL and file import) used to live in local state on the
// dashboard page, so navigating away mid-request unmounted it and silently
// threw away the result — even though the AI call had already completed and
// used up a weekly usage credit. Lifted here, inside the root layout, so it
// survives client-side navigation; a toast lets the user know when it's done
// if they're not currently looking at the dashboard.

type ExtractionContextType = {
  extracting: boolean
  extractedRecipe: any | null
  clearExtractedRecipe: () => void
  startUrlExtraction: (url: string) => Promise<void>

  importing: boolean
  showImportModal: boolean
  importedRecipes: any[]
  setImportedRecipes: (r: any[]) => void
  closeImportModal: () => void
  startFileImport: (file: File) => Promise<void>
}

const ExtractionContext = createContext<ExtractionContextType | null>(null)

export function useExtraction() {
  const ctx = useContext(ExtractionContext)
  if (!ctx) throw new Error("useExtraction must be used within ExtractionProvider")
  return ctx
}

export function ExtractionProvider({ children }: { children: React.ReactNode }) {
  const [extracting, setExtracting] = useState(false)
  const [extractedRecipe, setExtractedRecipe] = useState<any | null>(null)
  const [importing, setImporting] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importedRecipes, setImportedRecipes] = useState<any[]>([])

  const pathname = usePathname()
  const pathnameRef = useRef(pathname)
  pathnameRef.current = pathname

  const startUrlExtraction = useCallback(async (url: string) => {
    setExtracting(true)
    try {
      const res = await fetch("/api/extract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) })
      const data = await res.json()
      if (data.success) {
        setExtractedRecipe(data.recipe)
        if (pathnameRef.current !== "/dashboard") {
          toast.success(`"${data.recipe.title}" is ready to save`, { href: "/dashboard" })
        }
      } else {
        toast.error("Could not extract recipe. Try a different URL.")
      }
    } catch {
      toast.error("Could not extract recipe. Try a different URL.")
    } finally {
      setExtracting(false)
    }
  }, [])

  const startFileImport = useCallback(async (file: File) => {
    setImporting(true)
    setShowImportModal(true)
    setImportedRecipes([])

    async function run() {
      if (file.type.startsWith("image/") || file.type === "application/pdf") {
        const dataUrl: string = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
        return fetch("/api/extract-file", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: dataUrl, type: file.type === "application/pdf" ? "pdf" : "image" }),
        })
      }
      const text = await file.text()
      return fetch("/api/extract-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, type: "text" }),
      })
    }

    try {
      const res = await run()
      const data = await res.json()
      if (data.success) {
        setImportedRecipes(data.recipes)
        if (pathnameRef.current !== "/dashboard") {
          const n = data.recipes.length
          toast.success(`${n} recipe${n !== 1 ? "s" : ""} ready to save`, { href: "/dashboard" })
        }
      } else {
        toast.error("Could not extract recipe.")
      }
    } catch {
      toast.error("Could not extract recipe.")
    } finally {
      setImporting(false)
    }
  }, [])

  return (
    <ExtractionContext.Provider value={{
      extracting, extractedRecipe, clearExtractedRecipe: () => setExtractedRecipe(null), startUrlExtraction,
      importing, showImportModal, importedRecipes, setImportedRecipes,
      closeImportModal: () => setShowImportModal(false), startFileImport,
    }}>
      {children}
    </ExtractionContext.Provider>
  )
}
