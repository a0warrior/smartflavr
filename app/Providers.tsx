"use client"
import { SessionProvider } from "next-auth/react"
import { Toaster } from "./components/Toast"
import { ExtractionProvider } from "./components/ExtractionProvider"
import ModalScrollLock from "./components/ModalScrollLock"
import { ThemeProvider } from "./components/ThemeProvider"
import PresenceHeartbeat from "./components/PresenceHeartbeat"
import CookingTimerIndicator from "./components/CookingTimerIndicator"
import { CookingModeStatusProvider } from "./components/CookingModeStatus"

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <SessionProvider>
        <ExtractionProvider>
          <CookingModeStatusProvider>
            {children}
            <Toaster />
            <ModalScrollLock />
            <PresenceHeartbeat />
            <CookingTimerIndicator />
          </CookingModeStatusProvider>
        </ExtractionProvider>
      </SessionProvider>
    </ThemeProvider>
  )
}
