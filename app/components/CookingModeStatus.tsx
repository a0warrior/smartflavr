"use client"
import { createContext, useContext, useState } from "react"

// Lets CookingMode tell the rest of the app (specifically the global
// CookingTimerIndicator) that it's currently open — so the indicator can
// stay silent instead of double-ringing/vibrating alongside Cooking Mode's
// own in-page alarm for the same finished timer.
const CookingModeStatusContext = createContext<{ active: boolean; setActive: (v: boolean) => void }>({
  active: false,
  setActive: () => {},
})

export function CookingModeStatusProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState(false)
  return (
    <CookingModeStatusContext.Provider value={{ active, setActive }}>
      {children}
    </CookingModeStatusContext.Provider>
  )
}

export function useCookingModeStatus() {
  return useContext(CookingModeStatusContext)
}
