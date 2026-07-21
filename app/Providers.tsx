"use client"
import { SessionProvider } from "next-auth/react"
import { Toaster } from "./components/Toast"
import { ExtractionProvider } from "./components/ExtractionProvider"
import ModalScrollLock from "./components/ModalScrollLock"
import { ThemeProvider } from "./components/ThemeProvider"
import PresenceHeartbeat from "./components/PresenceHeartbeat"
import CookingTimerIndicator from "./components/CookingTimerIndicator"
import { CookingModeStatusProvider } from "./components/CookingModeStatus"
import PushNavigationListener from "./components/PushNavigationListener"

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
            <PushNavigationListener />
          </CookingModeStatusProvider>
        </ExtractionProvider>
      </SessionProvider>
    </ThemeProvider>
  )
}
