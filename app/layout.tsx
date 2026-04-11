"use client"
import { SessionProvider } from "next-auth/react"
import { Geist } from "next/font/google"
import "./globals.css"

const geist = Geist({ subsets: ["latin"] })

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={geist.className}>
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  )
}