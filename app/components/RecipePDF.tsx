import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer"

const s = StyleSheet.create({
  page: { padding: 48, fontFamily: "Helvetica", backgroundColor: "#ffffff", fontSize: 10, color: "#1f2937" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  brand: { fontSize: 12, color: "#f97316", fontFamily: "Helvetica-Bold" },
  title: { fontSize: 22, fontFamily: "Helvetica-Bold", marginBottom: 6, color: "#111827" },
  subtitle: { fontSize: 11, color: "#6b7280", marginBottom: 16 },
  chips: { flexDirection: "row", gap: 6, marginBottom: 14, flexWrap: "wrap" },
  chip: { backgroundColor: "#f3f4f6", borderRadius: 99, paddingVertical: 3, paddingHorizontal: 9, fontSize: 9, color: "#6b7280" },
  sectionLabel: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8, marginTop: 16 },
  ingredientRow: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: "#f9fafb" },
  bullet: { width: 14, fontSize: 10, color: "#f97316" },
  ingredientText: { flex: 1, fontSize: 10, color: "#374151" },
  stepRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  stepNum: { width: 20, height: 20, backgroundColor: "#fff7ed", borderRadius: 99, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  stepNumText: { fontSize: 9, color: "#c2410c", fontFamily: "Helvetica-Bold" },
  stepText: { flex: 1, fontSize: 10, lineHeight: 1.5, color: "#374151" },
  notes: { backgroundColor: "#fffbeb", borderRadius: 8, padding: 12, marginTop: 12 },
  notesText: { fontSize: 10, color: "#92400e", lineHeight: 1.5 },
  coverPage: { padding: 60, backgroundColor: "#fff7ed", flex: 1, alignItems: "center", justifyContent: "center" },
  coverEmoji: { fontSize: 56, marginBottom: 24, textAlign: "center" },
  coverTitle: { fontSize: 30, fontFamily: "Helvetica-Bold", color: "#111827", textAlign: "center", marginBottom: 8 },
  coverAuthor: { fontSize: 12, color: "#6b7280", textAlign: "center", marginBottom: 4 },
  coverCount: { fontSize: 10, color: "#9ca3af", textAlign: "center", marginTop: 8 },
  coverBrand: { fontSize: 11, color: "#f97316", fontFamily: "Helvetica-Bold", textAlign: "center", marginTop: 40 },
  tocTitle: { fontSize: 18, fontFamily: "Helvetica-Bold", marginBottom: 20, color: "#111827" },
  tocRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  tocLabel: { fontSize: 10, color: "#374151", flex: 1 },
  tocNum: { fontSize: 10, color: "#9ca3af" },
  footer: { position: "absolute", bottom: 28, left: 48, right: 48, flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 8, color: "#d1d5db" },
  divider: { height: 1, backgroundColor: "#f3f4f6", marginVertical: 10 },
})

function RecipePage({ recipe, showHeader = true }: { recipe: any; showHeader?: boolean }) {
  const ingredients = recipe.ingredients ? recipe.ingredients.split("\n").filter(Boolean) : []
  const instructions = recipe.instructions ? recipe.instructions.split("\n").filter(Boolean) : []

  return (
    <Page size="A4" style={s.page}>
      {showHeader && (
        <View style={s.header}>
          <Text style={s.brand}>SmartFlavr</Text>
          <Text style={{ fontSize: 8, color: "#d1d5db" }}>{new Date().toLocaleDateString()}</Text>
        </View>
      )}
      <Text style={s.title}>{recipe.title}</Text>
      {recipe.description ? <Text style={s.subtitle}>{recipe.description}</Text> : null}
      <View style={s.chips}>
        {recipe.prep_time ? <View style={s.chip}><Text>⏱ {recipe.prep_time}</Text></View> : null}
        {recipe.servings ? <View style={s.chip}><Text>👤 {recipe.servings} servings</Text></View> : null}
        {recipe.difficulty ? <View style={s.chip}><Text>★ {recipe.difficulty}</Text></View> : null}
      </View>
      {ingredients.length > 0 && (
        <View>
          <Text style={s.sectionLabel}>Ingredients</Text>
          {ingredients.map((ing: string, i: number) => (
            <View key={i} style={s.ingredientRow}>
              <Text style={s.bullet}>•</Text>
              <Text style={s.ingredientText}>{ing}</Text>
            </View>
          ))}
        </View>
      )}
      {instructions.length > 0 && (
        <View>
          <Text style={s.sectionLabel}>Instructions</Text>
          {instructions.map((step: string, i: number) => (
            <View key={i} style={s.stepRow}>
              <View style={s.stepNum}><Text style={s.stepNumText}>{i + 1}</Text></View>
              <Text style={s.stepText}>{step}</Text>
            </View>
          ))}
        </View>
      )}
      {recipe.notes ? (
        <View style={s.notes}>
          <Text style={s.notesText}>💡 {recipe.notes}</Text>
        </View>
      ) : null}
      {recipe.source_url ? (
        <Text style={{ fontSize: 8, color: "#9ca3af", marginTop: 12 }}>Source: {recipe.source_url}</Text>
      ) : null}
      <View style={s.footer}>
        <Text style={s.footerText}>SmartFlavr</Text>
        <Text style={s.footerText}>{recipe.title}</Text>
      </View>
    </Page>
  )
}

export function RecipeDocument({ recipe }: { recipe: any }) {
  return (
    <Document title={recipe.title} author="SmartFlavr">
      <RecipePage recipe={recipe} />
    </Document>
  )
}

export function CookbookDocument({ cookbook, recipes, authorName }: { cookbook: any; recipes: any[]; authorName: string }) {
  return (
    <Document title={cookbook.title} author="SmartFlavr">
      {/* Cover */}
      <Page size="A4" style={s.coverPage}>
        <Text style={s.coverEmoji}>{cookbook.cover_emoji || "📖"}</Text>
        <Text style={s.coverTitle}>{cookbook.title}</Text>
        <Text style={s.coverAuthor}>by {authorName}</Text>
        <Text style={s.coverCount}>{recipes.length} recipe{recipes.length !== 1 ? "s" : ""}</Text>
        <Text style={s.coverBrand}>SmartFlavr</Text>
      </Page>
      {/* Table of contents */}
      {recipes.length > 1 && (
        <Page size="A4" style={s.page}>
          <View style={s.header}>
            <Text style={s.brand}>SmartFlavr</Text>
          </View>
          <Text style={s.tocTitle}>Contents</Text>
          {recipes.map((r: any, i: number) => (
            <View key={r.id} style={s.tocRow}>
              <Text style={s.tocLabel}>{r.title}</Text>
              <Text style={s.tocNum}>{i + 1}</Text>
            </View>
          ))}
        </Page>
      )}
      {/* Recipe pages */}
      {recipes.map((r: any) => (
        <RecipePage key={r.id} recipe={r} />
      ))}
    </Document>
  )
}
