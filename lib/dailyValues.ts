// FDA 2020 Daily Value reference amounts, used to compute %DV from the raw
// per-serving amounts a user enters — no AI, no stored percentages, just
// straight arithmetic against a fixed table.
export const RDI = {
  protein: 50,       // g
  carbs: 275,        // g
  fat: 78,            // g
  fiber: 28,          // g
  sugar: 50,           // g (added sugars reference)
  sodium: 2300,        // mg
  vitamin_a: 900,      // mcg
  vitamin_c: 90,       // mg
  vitamin_d: 20,        // mcg
  vitamin_b12: 2.4,     // mcg
  vitamin_b6: 1.7,       // mg
  folate: 400,            // mcg
  calcium: 1300,           // mg
  iron: 18,                 // mg
  potassium: 4700,           // mg
  magnesium: 420,             // mg
  zinc: 11,                    // mg
  phosphorus: 1250,             // mg
} as const

export type RdiKey = keyof typeof RDI

export function percentDV(key: RdiKey, amount: number | undefined | null): number | null {
  if (amount === undefined || amount === null || isNaN(amount)) return null
  const ref = RDI[key]
  if (!ref) return null
  return Math.min(999, Math.round((amount / ref) * 100))
}
