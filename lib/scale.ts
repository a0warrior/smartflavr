// Recipe scaling: multiply the quantities in ingredient lines while keeping
// them kitchen-friendly (½, 1⅓, 2¼ — never 0.66666 cups). Display-only; the
// stored recipe text is never modified.

const UNICODE_FRACTIONS: Record<string, number> = {
  "¼": 0.25, "½": 0.5, "¾": 0.75,
  "⅓": 1 / 3, "⅔": 2 / 3,
  "⅛": 0.125, "⅜": 0.375, "⅝": 0.625, "⅞": 0.875,
}
const FRACTION_CHARS = Object.keys(UNICODE_FRACTIONS).join("")

// Best unicode fraction for a remainder, if one is close enough
const FRACTION_STEPS: [number, string][] = [
  [0.125, "⅛"], [0.25, "¼"], [1 / 3, "⅓"], [0.375, "⅜"], [0.5, "½"],
  [0.625, "⅝"], [2 / 3, "⅔"], [0.75, "¾"], [0.875, "⅞"],
]

// "1 1/2", "1½", "½", "3/4", "2.5", "3" → number
function tokenToNumber(token: string): number {
  let rest = token.trim()
  let total = 0
  const unicodeMatch = rest.match(new RegExp(`([${FRACTION_CHARS}])`))
  if (unicodeMatch) {
    total += UNICODE_FRACTIONS[unicodeMatch[1]]
    rest = rest.replace(unicodeMatch[1], "").trim()
  }
  const slashMatch = rest.match(/(\d+)\s*\/\s*(\d+)/)
  if (slashMatch) {
    total += parseInt(slashMatch[1]) / parseInt(slashMatch[2])
    rest = rest.replace(slashMatch[0], "").trim()
  }
  if (rest) {
    const n = parseFloat(rest)
    if (!isNaN(n)) total += n
  }
  return total
}

// 1.4999 → "1½", 0.33 → "⅓", 3 → "3", 2.2 → "2.2" (falls back to decimal)
export function toKitchenString(value: number): string {
  if (value <= 0) return "0"
  const whole = Math.floor(value + 0.0001)
  const remainder = value - whole
  if (remainder < 0.05) return String(whole)
  if (remainder > 0.95) return String(whole + 1)
  let best: string | null = null
  let bestDiff = 0.04 // tolerance — anything further from a nice fraction stays decimal
  for (const [num, char] of FRACTION_STEPS) {
    const diff = Math.abs(remainder - num)
    if (diff < bestDiff) { bestDiff = diff; best = char }
  }
  if (best) return whole > 0 ? `${whole}${best}` : best
  const rounded = Math.round(value * 100) / 100
  return String(rounded)
}

// Matches a quantity at the start of a line: "1 1/2", "1½", "½", "2.5", "3", and ranges "2-3" / "2 to 3"
const QTY = `(?:\\d+\\s+\\d+\\s*\\/\\s*\\d+|\\d+\\s*\\/\\s*\\d+|\\d*\\.?\\d+\\s*[${FRACTION_CHARS}]?|[${FRACTION_CHARS}])`
const LEADING_QTY_RE = new RegExp(`^\\s*(${QTY})(\\s*(?:-|–|to)\\s*(${QTY}))?`, "i")

// Scale one ingredient line. Lines without a leading quantity pass through untouched.
export function scaleIngredientLine(line: string, factor: number): string {
  if (factor === 1) return line
  const m = line.match(LEADING_QTY_RE)
  if (!m || !m[1]) return line
  const first = tokenToNumber(m[1])
  if (!first || isNaN(first)) return line
  let replacement = toKitchenString(first * factor)
  if (m[3]) {
    const second = tokenToNumber(m[3])
    if (second && !isNaN(second)) {
      replacement += `–${toKitchenString(second * factor)}`
    }
  }
  return replacement + line.slice(m[0].length)
}

// Pull a usable number out of a servings field like "4", "4 servings", "Serves 6", "4-6"
export function parseServings(servings: any): number | null {
  if (servings === null || servings === undefined) return null
  const str = String(servings)
  const m = str.match(/\d+(?:\.\d+)?/)
  if (!m) return null
  const n = parseFloat(m[0])
  return n > 0 && n < 1000 ? n : null
}
