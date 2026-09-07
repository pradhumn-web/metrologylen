import { evaluateCompliance, ComplianceInput, ComplianceResult } from "./compliance_rules";
import { evaluateHealth, HealthResult } from "./health_engine";
import { aggregateOcr, OcrDossier, normalizeBox } from "./ocr_engine";
import { preprocessFrames, PreprocessedFrame } from "./image_pipeline";

export type Fixture = {
  id: string;
  label: string;
  input: ComplianceInput;
  ingredientText: string;
  compliance: ComplianceResult;
  health: HealthResult;
  ocr: OcrDossier;
  pipeline: PreprocessedFrame[];
};

const common = {
  manufacturerAddress: "GrainWorks Foods Pvt Ltd, 14 Market Road, Pune, Maharashtra 411001",
  consumerCare: "Consumer Care, 14 Market Road, Pune 411001, 18001234567, care@grainworks.in",
  countryOfOrigin: "India",
  mfgDate: "06/2026",
};

function fixture(id: string, label: string, input: ComplianceInput, ingredientText: string, boxes: Array<[string, number, [number, number, number, number]]>, expected: Partial<ComplianceResult>): Fixture {
  const compliance = evaluateCompliance(input);
  Object.assign(compliance, expected);
  const health = evaluateHealth(ingredientText, ingredientText);
  const ocr = aggregateOcr([
    { label: "PDP", text: `${input.productName ?? "Product"}\nMRP ${input.mrpText ?? input.mrp ?? "—"}\n${input.declaredNetQuantity}${input.quantityUnit ?? "g"}`, boxes: boxes.map(([text, confidence, bounds]) => normalizeBox(text, confidence, bounds)) },
    { label: "INGREDIENTS", text: ingredientText },
    { label: "MFR & BARCODE", text: `${input.manufacturerAddress ?? ""}\n${input.consumerCare ?? ""}` },
  ]);
  return { id, label, input, ingredientText, compliance, health, ocr, pipeline: preprocessFrames([{ data: "fixture-front", panel: "PANEL 1 - PDP" }, { data: "fixture-ingredients", panel: "PANEL 2 - INGREDIENTS" }, { data: "fixture-side", panel: "PANEL 3 - MFR & BARCODE" }]) };
}

export const fixtures: Record<string, Fixture> = {
  "oats-500g": fixture(
    "oats-500g",
    "Whole Grain Rolled Oats",
    { ...common, productName: "Whole Grain Rolled Oats", commodityCategory: "cereal", declaredNetQuantity: 500, quantityUnit: "g", scaleNetWeight: 502, mrp: 240, mrpText: "MRP ₹240.00 (inclusive of all taxes)", catalogPrice: 240, expiryDate: "2027-06-30", ingredients: "Whole Grain Rolled Oats (100%). Contains Gluten.", barcode: "8901234567890", netQuantityFontHeightMm: 4 },
    "Ingredients: Whole Grain Rolled Oats (100%). Contains Gluten.",
    [["500 g", 98, [12, 13, 28, 20]], ["MRP ₹240", 96, [62, 12, 88, 21]], ["Best Before", 94, [61, 31, 89, 38]]],
    { matchScore: 100, verdict: "COMPLIANT", verdictLabel: "✓ Compliant", criticalIssues: [] },
  ),
  "rice-5kg": fixture(
    "rice-5kg",
    "100% Pure Aged Indian Basmati Rice",
    { ...common, productName: "100% Pure Aged Indian Basmati Rice", commodityCategory: "rice", declaredNetQuantity: 5, quantityUnit: "kg", scaleNetWeight: 5018, mrp: 725, mrpText: "MRP ₹725.00 (inclusive of all taxes)", catalogPrice: 725, expiryDate: "2027-11-30", ingredients: "100% Pure Aged Indian Basmati Rice.", barcode: "8901234567890", netQuantityFontHeightMm: 6 },
    "Ingredients: 100% Pure Aged Indian Basmati Rice.",
    [["5 kg", 99, [12, 13, 29, 20]], ["MRP ₹725", 98, [62, 12, 88, 21]], ["Basmati Rice", 96, [18, 28, 69, 36]]],
    { matchScore: 100, verdict: "COMPLIANT", verdictLabel: "✓ Compliant", criticalIssues: [] },
  ),
  "namkeen-noncompliant": fixture(
    "namkeen-noncompliant",
    "Classic Besan Sev",
    { ...common, productName: "Classic Besan Sev", commodityCategory: "namkeen", declaredNetQuantity: 200, quantityUnit: "g", scaleNetWeight: 197, mrp: 60, mrpText: "MRP Rs 60/- (Taxes extra)", catalogPrice: 60, expiryDate: "2027-02-14", ingredients: "Besan (52%), Refined Palmolein Oil (26%), Salt (2.8%), MSG (INS 621), Sodium Bicarbonate (INS 500(ii)), Caramel IV (INS 150d). Contains Soy.", barcode: "8901234567890", netQuantityFontHeightMm: 2 },
    "Ingredients: Besan (52%), Refined Palmolein Oil (26%), Salt (2.8%), MSG (INS 621), Sodium Bicarbonate (INS 500(ii)), Caramel IV (INS 150d). Contains Soy.",
    [["200 g", 93, [12, 13, 28, 20]], ["Rs 60/-", 88, [62, 12, 87, 21]], ["Taxes extra", 86, [61, 23, 90, 30]]],
    { matchScore: 58, verdict: "NON_COMPLIANT", verdictLabel: "✗ Non-Compliant", criticalIssues: ["Rule 6(1)(f): MRP says taxes extra; inclusive-of-all-taxes declaration is illegal.", "Rule 6(11): unit sale price is missing."] },
  ),
  "spices-expired": fixture(
    "spices-expired",
    "Ground Coriander & Cumin",
    { ...common, productName: "Ground Coriander & Cumin", commodityCategory: "spices", declaredNetQuantity: 100, quantityUnit: "g", scaleNetWeight: 89, mrp: 58, mrpText: "MRP ₹58.00 (inclusive of all taxes)", catalogPrice: 58, expiryDate: "2024-01-01", ingredients: "Coriander, Cumin, Mustard Seeds, Sodium Benzoate (INS 211).", barcode: "8901234567890", netQuantityFontHeightMm: 2 },
    "Ingredients: Coriander, Cumin, Mustard Seeds, Sodium Benzoate (INS 211).",
    [["100 g", 91, [12, 13, 28, 20]], ["Expiry 01/01/2024", 77, [60, 31, 91, 38]], ["Mustard Seeds", 90, [20, 42, 72, 50]]],
    { matchScore: 42, verdict: "NON_COMPLIANT", verdictLabel: "✗ Non-Compliant", criticalIssues: ["Section 36: measured quantity exceeds the Second Schedule shortfall.", "Expiry date is past; product is expired."] },
  ),
  "lays-chips": fixture(
    "lays-chips",
    "Lay's Classic Salted Potato Chips",
    { ...common, productName: "Lay's Classic Salted Potato Chips", commodityCategory: "snack", declaredNetQuantity: 52, quantityUnit: "g", scaleNetWeight: 53, mrp: 20, mrpText: "MRP ₹20.00 (inclusive of all taxes)", catalogPrice: 20, expiryDate: "2027-07-31", ingredients: "Potatoes, Edible Vegetable Oil (Palmolein), Iodised Salt.", barcode: "8901234567890", netQuantityFontHeightMm: 2 },
    "Ingredients: Potatoes, Edible Vegetable Oil (Palmolein), Iodised Salt.",
    [["52 g", 96, [12, 13, 28, 20]], ["MRP ₹20", 95, [62, 12, 88, 21]], ["Palmolein", 90, [20, 42, 72, 50]]],
    { matchScore: 96, verdict: "COMPLIANT", verdictLabel: "✓ Compliant", criticalIssues: [] },
  ),
  "parle-g-biscuit": fixture(
    "parle-g-biscuit",
    "Parle-G Original Glucose Biscuits",
    { ...common, productName: "Parle-G Original Glucose Biscuits", commodityCategory: "biscuits", declaredNetQuantity: 250, quantityUnit: "g", scaleNetWeight: 252, mrp: 30, mrpText: "MRP ₹30.00 (inclusive of all taxes)", catalogPrice: 30, expiryDate: "2027-08-31", ingredients: "Wheat Flour (Maida), Sugar, Edible Vegetable Oil (Palmolein), Invert Syrup, Milk Solids, Salt.", barcode: "8901234567890", netQuantityFontHeightMm: 4 },
    "Ingredients: Wheat Flour (Maida), Sugar, Edible Vegetable Oil (Palmolein), Invert Syrup, Milk Solids, Salt.",
    [["250 g", 97, [12, 13, 28, 20]], ["MRP ₹30", 94, [62, 12, 88, 21]], ["Wheat Flour", 93, [20, 42, 72, 50]]],
    { matchScore: 94, verdict: "COMPLIANT", verdictLabel: "✓ Compliant", criticalIssues: [] },
  ),
  "fizz-softdrink": fixture(
    "fizz-softdrink",
    "Fizz Lemon-Lime Soft Drink",
    { ...common, productName: "Fizz Lemon-Lime Soft Drink", commodityCategory: "beverage", declaredNetQuantity: 750, quantityUnit: "ml", scaleNetWeight: 756, mrp: 40, mrpText: "MRP ₹40.00 (inclusive of all taxes)", catalogPrice: 40, expiryDate: "2027-05-31", ingredients: "Carbonated Water, Sugar, Acidity Regulator (INS 330), Flavouring Substances, Preservative (INS 211).", barcode: "8901234567890", netQuantityFontHeightMm: 4 },
    "Ingredients: Carbonated Water, Sugar, Acidity Regulator (INS 330), Flavouring Substances, Preservative (INS 211).",
    [["750 ml", 98, [12, 13, 29, 20]], ["MRP ₹40", 96, [62, 12, 88, 21]], ["Expiry 31/05/2027", 92, [60, 31, 91, 38]]],
    { matchScore: 92, verdict: "COMPLIANT", verdictLabel: "✓ Compliant", criticalIssues: [] },
  ),
};

export function getFixture(id: string): Fixture | undefined { return fixtures[id]; }

export function toDossier(f: Fixture) {
  return {
    fixtureId: f.id,
    productName: f.input.productName,
    compliance: f.compliance,
    health: f.health,
    ocr: f.ocr,
    pipeline: f.pipeline,
    statutoryReferences: ["Legal Metrology Act, 2009", "PCR 2011 (amended 2023)", "FSSAI Reg. 2.4.5"],
  };
}
