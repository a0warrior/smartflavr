"use client"
import { SessionProvider } from "next-auth/react"
import { Toaster } from "./components/Toast"
import { ExtractionProvider } from "./components/ExtractionProvider"
import ModalScrollLock from "./components/ModalScrollLock"

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ExtractionProvider>
        {children}
        <Toaster />
        <ModalScrollLock />
      </ExtractionProvider>
    </SessionProvider>
  )
}
