import { Geist } from "next/font/google"
import "./globals.css"
import Providers from "./Providers"

const geist = Geist({ subsets: ["latin"] })

export const metadata = {
  title: "SmartFlavr",
  description: "Your AI-powered recipe cookbook",
  icons: {
    icon: "/icon-192-v2.png",
    apple: "/apple-touch-icon-v2.png",
  },
  appleWebApp: {
    capable: true,
    title: "SmartFlavr",
    statusBarStyle: "default" as const,
  },
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
  // Stops iOS auto-zooming when focusing inputs; manual pinch-zoom still works
  maximumScale: 1,
  viewportFit: "cover" as const,
  themeColor: "#F97316",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        {/* Blocking (not deferred) so the theme class is set before first
            paint — otherwise a dark-mode user briefly sees a white flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("smartflavr_theme");if(t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.classList.add("dark")}}catch(e){}})()`,
          }}
        />
      </head>
      <body className={geist.className}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}