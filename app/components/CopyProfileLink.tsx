"use client"
import { useState } from "react"

export default function CopyProfileLink({ username, className }: { username: string; className?: string }) {
  const [copied, setCopied] = useState(false)

  function copyLink() {
    navigator.clipboard.writeText(`${window.location.origin}/u/${username}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={copyLink}
      className={`px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition ${className || ""}`}>
      {copied ? "✓ Copied!" : "Copy link"}
    </button>
  )
}