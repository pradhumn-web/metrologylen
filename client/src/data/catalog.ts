export type ChipProduct = {
  id: string;
  brand: string;
  product: string;
  declared: string;
  measured: string;
  mrp: string;
  usp: string;
  manufacturer: string;
  origin: string;
  mfgDate: string;
  bestBefore: string;
  consumerCare: string;
  barcode: string;
  ingredients: string[];
  allergens: string[];
  risks: Array<{ name: string; level: "low" | "review" | "high"; score: number; reason: string }>;
  verdict: "COMPLIANT" | "NEEDS_REVIEW";
  score: number;
  rules: boolean[];
};

export const metrologyRules = [
  ["R1", "Manufacturer / packer / importer", "Name and complete postal address"],
  ["R2", "Country of origin", "Required country declaration"],
  ["R3", "Generic commodity name", "Clear principal display panel name"],
  ["R4", "Net quantity", "Metric quantity and correct unit"],
  ["R5", "Manufacture / pack date", "Month and year declaration"],
  ["R6", "Best-before / expiry", "Readable date or shelf-life statement"],
  ["R7", "Maximum retail price", "MRP inclusive of all taxes"],
  ["R8", "Unit sale price", "Derived price per standard unit"],
  ["R9", "Consumer care", "Phone, email, and postal contact"],
  ["R10", "Barcode / traceability", "Barcode, batch, or lot reference"],
] as const;

export const chipProducts: ChipProduct[] = [
  { id: "chips-lays", brand: "Lay's", product: "Lay's Classic Salted Chips", declared: "52 g", measured: "53 g", mrp: "₹20.00", usp: "₹0.38/g", manufacturer: "Demo Foods India Pvt Ltd, Gurugram 122001", origin: "India", mfgDate: "06/2026", bestBefore: "6 months", consumerCare: "18001234567 · care@demofoods.in", barcode: "8901000000001", ingredients: ["Potatoes", "Edible Vegetable Oil (Palmolein)", "Iodised Salt"], allergens: ["No major allergen detected"], risks: [{ name: "Hypertension & CVD", level: "review", score: 68, reason: "Iodised salt is declared." }, { name: "Atherosclerosis & lipids", level: "high", score: 72, reason: "Palmolein oil is declared." }], verdict: "COMPLIANT", score: 96, rules: Array(10).fill(true) },
  { id: "chips-bingo", brand: "Bingo!", product: "Bingo! Salted Chips", declared: "90 g", measured: "91 g", mrp: "₹50.00", usp: "₹0.56/g", manufacturer: "Demo Snacks India Ltd, Bengaluru 560001", origin: "India", mfgDate: "06/2026", bestBefore: "6 months", consumerCare: "18001234568 · care@demosnacks.in", barcode: "8901000000002", ingredients: ["Potatoes", "Edible Vegetable Oil", "Iodised Salt", "Spices", "Acidity Regulator (INS 330)"], allergens: ["No major allergen detected"], risks: [{ name: "Hypertension & CVD", level: "review", score: 55, reason: "Iodised salt is declared." }, { name: "Additive sensitivity", level: "review", score: 28, reason: "INS 330 is declared." }], verdict: "COMPLIANT", score: 94, rules: Array(10).fill(true) },
  { id: "chips-balaji", brand: "Balaji", product: "Balaji Salted Wafers", declared: "55 g", measured: "54 g", mrp: "₹20.00", usp: "₹0.36/g", manufacturer: "Demo Wafers Pvt Ltd, Rajkot 360001", origin: "India", mfgDate: "06/2026", bestBefore: "6 months", consumerCare: "18001234569 · care@demowafers.in", barcode: "8901000000003", ingredients: ["Potatoes", "Palmolein Oil", "Salt", "Sugar", "Spices", "Milk Solids"], allergens: ["Dairy · Milk Solids"], risks: [{ name: "Lactose intolerance", level: "high", score: 72, reason: "Milk solids are declared." }, { name: "Hypertension & CVD", level: "review", score: 61, reason: "Salt is declared." }], verdict: "NEEDS_REVIEW", score: 88, rules: Array(10).fill(true) },
  { id: "chips-tooyumm", brand: "Too Yumm!", product: "Too Yumm! Potato Chips", declared: "70 g", measured: "68 g", mrp: "₹35.00", usp: "₹0.50/g", manufacturer: "Demo Better Snacks Ltd, Gurugram 122018", origin: "India", mfgDate: "06/2026", bestBefore: "6 months", consumerCare: "18001234570 · care@demobetter.in", barcode: "8901000000004", ingredients: ["Potatoes", "Rice Bran Oil", "Salt", "Chilli", "Acidity Regulator (INS 330)"], allergens: ["No major allergen detected"], risks: [{ name: "Hypertension & CVD", level: "review", score: 48, reason: "Salt is declared." }, { name: "Additive sensitivity", level: "review", score: 28, reason: "INS 330 is declared." }], verdict: "COMPLIANT", score: 91, rules: Array(10).fill(true) },
  { id: "chips-unclechipps", brand: "Uncle Chipps", product: "Uncle Chipps Plain Salted", declared: "55 g", measured: "55 g", mrp: "₹20.00", usp: "₹0.36/g", manufacturer: "Demo Foods India Pvt Ltd, New Delhi 110001", origin: "India", mfgDate: "06/2026", bestBefore: "6 months", consumerCare: "18001234571 · care@demochipps.in", barcode: "8901000000005", ingredients: ["Potatoes", "Edible Vegetable Oil", "Salt", "Sugar", "Spices", "Soy"], allergens: ["Soy · Critical"], risks: [{ name: "Soy sensitivity", level: "high", score: 82, reason: "Soy is explicitly declared." }, { name: "Diabetes mellitus", level: "review", score: 31, reason: "Sugar is declared." }], verdict: "NEEDS_REVIEW", score: 86, rules: Array(10).fill(true) },
];

export const findChip = (value: string) => {
  const normalized = value.toLowerCase();
  return chipProducts.find(product => normalized.includes(product.brand.toLowerCase()) || normalized.includes(product.product.toLowerCase())) ?? chipProducts[0];
};
