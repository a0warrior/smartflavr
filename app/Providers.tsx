"use client"
import { SessionProvider } from "next-auth/react"
import { Toaster } from "./components/Toast"
import { ExtractionProvider } from "./components/ExtractionProvider"

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ExtractionProvider>
        {children}
        <Toaster />
      </ExtractionProvider>
    </SessionProvider>
  )
}
