"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"

const tabs = [
  {
    href: "/dashboard", label: "Home",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    href: "/feed", label: "Feed",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
      </svg>
    ),
  },
  {
    href: "/explore", label: "Explore",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
    ),
  },
  {
    href: "/meal-planner", label: "Planner",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
  },
  {
    href: "/inventory", label: "Kitchen",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 8V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v2"/><path d="M3 8v11a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8"/><line x1="3" y1="8" x2="21" y2="8"/><line x1="12" y1="12" x2="12" y2="15"/>
      </svg>
    ),
  },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav id="bottom-nav" className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-white/95 backdrop-blur-sm border-t border-gray-100 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-stretch justify-around">
        {tabs.map(tab => {
          const active = pathname === tab.href || (tab.href !== "/dashboard" && pathname.startsWith(tab.href))
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center gap-0.5 pt-2 pb-1.5 flex-1 transition ${active ? "text-orange-500" : "text-gray-400 active:text-gray-600"}`}>
              {tab.icon}
              <span className={`text-[10px] leading-tight ${active ? "font-semibold" : "font-medium"}`}>{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
