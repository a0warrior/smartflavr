import { Geist } from "next/font/google"
import "./globals.css"
import Providers from "./Providers"

const geist = Geist({ subsets: ["latin"] })

export const metadata = {
  title: "SmartFlavr",
  description: "Your AI-powered recipe cookbook",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={geist.className}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}