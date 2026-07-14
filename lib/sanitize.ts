// Shared sanitization helpers.
//
// React escapes user content in JSX automatically — these helpers cover the
// places that bypass React: HTML built as strings for print windows /
// document.write, and user-supplied URLs rendered into href attributes.

// Escape a string for safe interpolation into an HTML document string.
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

// Only allow http(s) URLs into href attributes — blocks javascript:, data:,
// vbscript: and friends. Returns undefined for anything unsafe so callers can
// skip rendering the link entirely.
export function safeHttpUrl(url: unknown): string | undefined {
  if (typeof url !== "string") return undefined
  const trimmed = url.trim()
  if (!/^https?:\/\/[^\s]+$/i.test(trimmed)) return undefined
  if (trimmed.length > 2048) return undefined
  return trimmed
}
