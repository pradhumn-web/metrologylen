export type AllergenId = "gluten" | "dairy" | "peanuts_tree_nuts" | "soy" | "eggs" | "fish_shellfish" | "sesame" | "mustard" | "sulfites";
export type AllergenResult = { id: AllergenId; name: string; present: boolean; matchedKeywords: string[]; severity: "critical" | "moderate" };
export type AdditiveToken = { raw: string; code: string; name: string; functionalClass: string; clinicalRisk: "low" | "moderate" | "high" };
export type HealthResult = {
  ingredientText: string;
  ingredientTokens: Array<{ name: string; percentage?: number }>;
  additives: AdditiveToken[];
  allergens: AllergenResult[];
  chronicRisks: Array<{ id: string; name: string; level: "low" | "warning" | "danger"; reason: string; score: number }>;
  lifestyleFlags: { isVegetarian: boolean; isVegan: boolean; isGlutenFree: boolean; isSugarFree: boolean; isLowSodium: boolean };
  overallRiskLevel: "low" | "moderate" | "high";
  statutoryLine: string;
};

type ChronicRisk = HealthResult["chronicRisks"][number];

const registry: Record<string, Omit<AdditiveToken, "raw" | "code">> = {
  "621": { name: "monosodium glutamate", functionalClass: "flavour enhancer", clinicalRisk: "moderate" },
  "500(ii)": { name: "sodium bicarbonate", functionalClass: "raising agent", clinicalRisk: "moderate" },
  "330": { name: "citric acid", functionalClass: "acidity regulator", clinicalRisk: "low" },
  "150d": { name: "caramel IV", functionalClass: "colour", clinicalRisk: "moderate" },
  "211": { name: "sodium benzoate", functionalClass: "preservative", clinicalRisk: "moderate" },
  "951": { name: "aspartame", functionalClass: "sweetener", clinicalRisk: "high" },
  "322": { name: "lecithins", functionalClass: "emulsifier", clinicalRisk: "low" },
};

const allergenSets: Array<{ id: AllergenId; name: string; keywords: string[]; severity: "critical" | "moderate" }> = [
  { id: "gluten", name: "Gluten", keywords: ["gluten", "wheat", "maida", "atta", "suji", "barley", "malt", "rye", "spelt", "triticale"], severity: "critical" },
  { id: "dairy", name: "Dairy", keywords: ["milk", "whey", "casein", "butter", "ghee", "cheese", "milk solids", "lactose"], severity: "critical" },
  { id: "peanuts_tree_nuts", name: "Peanuts / tree nuts", keywords: ["peanut", "groundnut", "almond", "cashew", "walnut", "hazelnut"], severity: "critical" },
  { id: "soy", name: "Soy", keywords: ["soy", "soya", "soybean", "soy lecithin", "tofu"], severity: "critical" },
  { id: "eggs", name: "Eggs", keywords: ["egg", "egg white", "yolk", "albumin", "ovalbumin"], severity: "critical" },
  { id: "fish_shellfish", name: "Fish / shellfish", keywords: ["fish", "prawn", "crab", "shrimp", "crustacean"], severity: "critical" },
  { id: "sesame", name: "Sesame", keywords: ["sesame", "til"], severity: "moderate" },
  { id: "mustard", name: "Mustard", keywords: ["mustard", "sarson", "rai"], severity: "moderate" },
  { id: "sulfites", name: "Sulfites", keywords: ["sulfur dioxide", "sulfites", "ins 150d", "ins 220", "ins 221", "ins 222", "ins 223", "ins 224", "ins 225", "ins 226", "ins 227", "ins 228"], severity: "moderate" },
];

function normalized(text: string) { return text.toLowerCase(); }

export function extractIngredientText(text: string): string {
  const match = text.match(/(?:Ingredients?|Contains|Ingrédients)\s*:\s*([^\n]+)/i);
  return match?.[1]?.trim() ?? text.trim();
}

export function tokenizeIngredients(text: string): Array<{ name: string; percentage?: number }> {
  const ingredientText = extractIngredientText(text);
  return ingredientText.split(/,(?![^()]*\))/).map(part => part.trim()).filter(Boolean).map(raw => {
    const percentage = raw.match(/\((\d+(?:\.\d+)?)%\)/)?.[1];
    return { name: raw.replace(/\s*\(\d+(?:\.\d+)?%\)/, "").trim(), ...(percentage ? { percentage: Number(percentage) } : {}) };
  });
}

export function detectAdditives(text: string): AdditiveToken[] {
  const result: AdditiveToken[] = [];
  const pattern = /(?:INS\s*)?(\d{3,4}(?:\([a-ziv]+\)|[a-z]?))/gi;
  Array.from(text.matchAll(pattern)).forEach(match => {
    const rawCode = match[1];
    const code = rawCode.toLowerCase().replace(/[()]/g, "");
    const key = Object.keys(registry).find(k => k.toLowerCase().replace(/[()]/g, "") === code);
    if (key && !result.some(item => item.code === key)) result.push({ raw: match[0], code: key, ...registry[key] });
  });
  return result;
}

export function evaluateHealth(ingredientText: string, explicitText = ""): HealthResult {
  const combined = `${ingredientText} ${explicitText}`.trim();
  const lower = normalized(combined);
  const tokens = tokenizeIngredients(ingredientText);
  const additives = detectAdditives(combined);
  const allergens = allergenSets.map(allergen => {
    const matchedKeywords = allergen.keywords.filter(keyword => lower.includes(keyword));
    if (additives.some(additive => additive.code === "150d") && allergen.id === "sulfites") matchedKeywords.push("INS 150d");
    return { id: allergen.id, name: allergen.name, present: matchedKeywords.length > 0, matchedKeywords: Array.from(new Set(matchedKeywords)), severity: allergen.severity };
  });
  const hasAny = (words: string[]) => words.some(word => lower.includes(word));
  const sodiumHits = ["salt", "sodium", "msg", "ins 621", "baking soda", "sodium bicarbonate", "ins 500"].filter(word => lower.includes(word));
  const sugarHits = ["sugar", "cane sugar", "liquid glucose", "invert syrup", "maltodextrin"].filter(word => lower.includes(word));
  const fatHits = ["palm oil", "palmolein", "trans fat", "partially hydrogenated"].filter(word => lower.includes(word));
  const chronicRisks: ChronicRisk[] = [
    { id: "hypertension_cvd", name: "Hypertension & CVD", level: sodiumHits.length >= 2 ? "danger" : sodiumHits.length ? "warning" : "low", reason: sodiumHits.length ? `Matched ${sodiumHits.join(", ")}.` : "No sodium-loaded ingredient signal found.", score: Math.min(100, sodiumHits.length * 33) },
    { id: "diabetes", name: "Diabetes mellitus", level: sugarHits.length >= 2 ? "danger" : sugarHits.length ? "warning" : "low", reason: sugarHits.length ? `Matched ${sugarHits.join(", ")}.` : "No added-sugar signal found.", score: Math.min(100, sugarHits.length * 38) },
    { id: "celiac", name: "Celiac disease", level: allergens.find(a => a.id === "gluten")?.present ? "danger" : "low", reason: allergens.find(a => a.id === "gluten")?.present ? "Gluten ingredient detected." : "No gluten keyword detected.", score: allergens.find(a => a.id === "gluten")?.present ? 100 : 0 },
    { id: "atherosclerosis", name: "Atherosclerosis & lipids", level: fatHits.length ? "danger" : "low", reason: fatHits.length ? `Matched ${fatHits.join(", ")}.` : "No palm or hydrogenated fat signal found.", score: Math.min(100, fatHits.length * 45) },
    { id: "lactose", name: "Lactose intolerance", level: hasAny(["milk", "dairy", "whey", "lactose"]) ? "warning" : "low", reason: hasAny(["milk", "dairy", "whey", "lactose"]) ? "Dairy derivative detected." : "No dairy keyword detected.", score: hasAny(["milk", "dairy", "whey", "lactose"]) ? 55 : 0 },
  ];
  const criticalAllergenPresent = allergens.some(a => a.present && a.severity === "critical");
  const overallRiskLevel = chronicRisks.some(r => r.level === "danger") || additives.some(a => a.clinicalRisk === "high") ? "high" : criticalAllergenPresent || chronicRisks.some(r => r.level === "warning") ? "moderate" : "low";
  const vegetarian = !hasAny(["chicken", "mutton", "beef", "pork", "fish", "prawn", "crab", "gelatin"]);
  const vegan = vegetarian && !hasAny(["milk", "whey", "casein", "butter", "ghee", "cheese", "egg", "honey"]);
  const statutoryAllergens = allergens.filter(a => a.present).map(a => a.name).join(", ");
  return {
    ingredientText: extractIngredientText(ingredientText),
    ingredientTokens: tokens,
    additives,
    allergens,
    chronicRisks,
    lifestyleFlags: { isVegetarian: vegetarian, isVegan: vegan, isGlutenFree: !allergens.find(a => a.id === "gluten")!.present, isSugarFree: sugarHits.length === 0, isLowSodium: sodiumHits.length === 0 },
    overallRiskLevel,
    statutoryLine: statutoryAllergens ? `ALLERGEN DECLARATION (FSSAI Reg. 2.4.5): Contains ${statutoryAllergens}. Sensitive consumers must exercise strict caution.` : "ALLERGEN DECLARATION (FSSAI Reg. 2.4.5): No declared allergen keyword detected.",
  };
}
