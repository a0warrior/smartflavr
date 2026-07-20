"use client"
import { SessionProvider } from "next-auth/react"
import { Toaster } from "./components/Toast"
import { ExtractionProvider } from "./components/ExtractionProvider"
import ModalScrollLock from "./components/ModalScrollLock"
import { ThemeProvider } from "./components/ThemeProvider"
import PresenceHeartbeat from "./components/PresenceHeartbeat"
import CookingTimerIndicator from "./components/CookingTimerIndicator"

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <SessionProvider>
        <ExtractionProvider>
          {children}
          <Toaster />
          <ModalScrollLock />
          <PresenceHeartbeat />
          <CookingTimerIndicator />
        </ExtractionProvider>
      </SessionProvider>
    </ThemeProvider>
  )
}
