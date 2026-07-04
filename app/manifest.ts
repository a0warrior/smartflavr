import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SmartFlavr",
    short_name: "SmartFlavr",
    description: "Your AI-powered recipe cookbook",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#FFF7ED",
    theme_color: "#F97316",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
