"use client"
import { createContext, useContext, useEffect, useState } from "react"

type Theme = "light" | "dark"
type Ctx = { theme: Theme; toggleTheme: () => void; setTheme: (t: Theme) => void }

const ThemeContext = createContext<Ctx | null>(null)

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider")
  return ctx
}

// The blocking inline script in layout.tsx already applies the right class
// to <html> before paint (avoiding a flash of the wrong theme); this just
// mirrors that into React state so components can read/toggle it.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light")

  useEffect(() => {
    setThemeState(document.documentElement.classList.contains("dark") ? "dark" : "light")
  }, [])

  function setTheme(t: Theme) {
    setThemeState(t)
    document.documentElement.classList.toggle("dark", t === "dark")
    localStorage.setItem("smartflavr_theme", t)
  }

  function toggleTheme() {
    setTheme(theme === "dark" ? "light" : "dark")
  }

  return <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>{children}</ThemeContext.Provider>
}
