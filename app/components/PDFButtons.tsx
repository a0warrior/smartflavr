"use client"
import type { ReactNode } from "react"
import { escapeHtml } from "@/lib/sanitize"

const esc = escapeHtml

const CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1f2937; background: #fff; padding: 48px; max-width: 720px; margin: 0 auto; font-size: 14px; }
  .header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 16px; border-bottom: 1px solid #f3f4f6; margin-bottom: 24px; }
  .brand { color: #f97316; font-weight: 700; font-size: 13px; }
  .date { color: #d1d5db; font-size: 11px; }
  h1 { font-size: 26px; font-weight: 700; margin-bottom: 6px; color: #111827; }
  h2 { font-size: 22px; font-weight: 700; margin-bottom: 6px; color: #111827; }
  .desc { color: #6b7280; font-size: 13px; margin-bottom: 14px; line-height: 1.5; }
  .chips { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px; }
  .chip { background: #f3f4f6; border-radius: 99px; padding: 4px 12px; font-size: 12px; color: #6b7280; }
  .section-label { font-size: 10px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; margin: 22px 0 10px; }
  .ingredient { display: flex; align-items: flex-start; gap: 10px; padding: 7px 0; border-bottom: 1px solid #f9fafb; font-size: 13px; color: #374151; }
  .bullet { color: #f97316; font-size: 16px; line-height: 1; flex-shrink: 0; }
  .step { display: flex; gap: 12px; margin-bottom: 12px; }
  .step-num { min-width: 24px; height: 24px; background: #fff7ed; color: #c2410c; font-size: 11px; font-weight: 700; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px; }
  .step-text { font-size: 13px; line-height: 1.6; color: #374151; }
  .notes { background: #fffbeb; border-radius: 8px; padding: 14px 16px; font-size: 13px; color: #92400e; line-height: 1.5; margin-top: 20px; }
  .source { font-size: 11px; color: #9ca3af; margin-top: 14px; }
  .footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #f3f4f6; display: flex; justify-content: space-between; font-size: 11px; color: #d1d5db; }
  .cover { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; background: #fff7ed; padding: 60px; }
  .cover-emoji { font-size: 72px; margin-bottom: 28px; }
  .cover-title { font-size: 36px; font-weight: 700; color: #111827; margin-bottom: 10px; }
  .cover-author { font-size: 15px; color: #6b7280; margin-bottom: 6px; }
  .cover-count { font-size: 13px; color: #9ca3af; margin-top: 10px; }
  .cover-brand { font-size: 14px; color: #f97316; font-weight: 700; margin-top: 48px; }
  .toc-title { font-size: 22px; font-weight: 700; margin-bottom: 20px; color: #111827; }
  .toc-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f3f4f6; font-size: 13px; color: #374151; }
  .toc-num { color: #9ca3af; }
  .page-break { page-break-before: always; padding-top: 48px; }
  @media print { @page { margin: 16mm; } body { padding: 0; } }
`

function recipeHtml(recipe: any, today: string) {
  const ingredients = recipe.ingredients ? recipe.ingredients.split("\n").filter(Boolean) : []
  const instructions = recipe.instructions ? recipe.instructions.split("\n").filter(Boolean) : []
  return `
    <div class="header"><span class="brand">SmartFlavr</span><span class="date">${esc(today)}</span></div>
    <h1>${esc(recipe.title)}</h1>
    ${recipe.description ? `<p class="desc">${esc(recipe.description)}</p>` : ""}
    <div class="chips">
      ${recipe.prep_time ? `<span class="chip">Time: ${esc(recipe.prep_time)}</span>` : ""}
      ${recipe.servings ? `<span class="chip">Serves: ${esc(recipe.servings)}</span>` : ""}
      ${recipe.difficulty ? `<span class="chip">Difficulty: ${esc(recipe.difficulty)}</span>` : ""}
    </div>
    ${ingredients.length ? `
      <div class="section-label">Ingredients</div>
      ${ingredients.map((ing: string) => `<div class="ingredient"><span class="bullet">•</span><span>${esc(ing)}</span></div>`).join("")}
    ` : ""}
    ${instructions.length ? `
      <div class="section-label">Instructions</div>
      ${instructions.map((step: string, i: number) => `
        <div class="step">
          <div class="step-num">${i + 1}</div>
          <div class="step-text">${esc(step)}</div>
        </div>
      `).join("")}
    ` : ""}
    ${recipe.notes ? `<div class="notes">Note: ${esc(recipe.notes)}</div>` : ""}
    ${recipe.source_url ? `<div class="source">Source: ${esc(recipe.source_url)}</div>` : ""}
    <div class="footer"><span>SmartFlavr</span><span>${esc(recipe.title)}</span></div>
  `
}

function printHtml(body: string, title: string) {
  const win = window.open("", "_blank")
  if (!win) return
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${CSS}</style></head><body>${body}</body></html>`)
  win.document.close()
  win.focus()
  setTimeout(() => { win.print() }, 400)
}

export function RecipePDFButton({ recipe, className, children }: { recipe: any; className?: string; children?: ReactNode }) {
  function print() {
    printHtml(`<div>${recipeHtml(recipe, new Date().toLocaleDateString())}</div>`, recipe.title)
  }
  return (
    <button
      onClick={print}
      className={className ?? "px-3 py-1.5 border border-gray-200 text-gray-500 rounded-lg text-xs hover:bg-gray-50 transition flex items-center gap-1.5"}
    >
      {children ?? "Print / Save PDF"}
    </button>
  )
}

export function CookbookPDFButton({ cookbook, recipes, authorName, className, children }: { cookbook: any; recipes: any[]; authorName: string; className?: string; children?: ReactNode }) {
  function print() {
    const today = new Date().toLocaleDateString()
    const cover = `
      <div class="cover">
        <div class="cover-emoji">${esc(cookbook.cover_emoji || "📖")}</div>
        <div class="cover-title">${esc(cookbook.title)}</div>
        <div class="cover-author">by ${esc(authorName)}</div>
        <div class="cover-count">${recipes.length} recipe${recipes.length !== 1 ? "s" : ""}</div>
        <div class="cover-brand">SmartFlavr</div>
      </div>
    `
    const toc = recipes.length > 1 ? `
      <div class="page-break">
        <div class="toc-title">Contents</div>
        ${recipes.map((r, i) => `<div class="toc-row"><span>${esc(r.title)}</span><span class="toc-num">${i + 1}</span></div>`).join("")}
      </div>
    ` : ""
    const pages = recipes.map(r => `<div class="page-break">${recipeHtml(r, today)}</div>`).join("")
    printHtml(cover + toc + pages, cookbook.title)
  }
  return (
    <button
      onClick={print}
      className={className ?? "px-3 py-1.5 border border-gray-200 text-gray-500 rounded-lg text-xs hover:bg-gray-50 transition flex items-center gap-1.5"}
    >
      {children ?? "Print cookbook"}
    </button>
  )
}
