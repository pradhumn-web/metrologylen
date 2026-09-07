export type Verdict = "COMPLIANT" | "NEEDS_REVIEW" | "NON_COMPLIANT";
export type RiskStatus = "CRITICAL_EXPIRED" | "MODERATE_RISK" | "LOW_RISK";
export type DeclarationStatus = "PRESENT" | "UNDERSIZED" | "ILLEGAL_SYNTAX" | "MISSING" | "NA";

export type ComplianceInput = {
  productName?: string;
  commodityCategory?: string;
  declaredNetQuantity: number;
  quantityUnit?: string;
  scaleNetWeight?: number;
  mrp?: number | string;
  mrpText?: string;
  catalogPrice?: number;
  mfgDate?: string;
  expiryDate?: string;
  manufacturerAddress?: string;
  consumerCare?: string;
  countryOfOrigin?: string;
  ingredients?: string;
  dimensions?: string;
  netQuantityFontHeightMm?: number;
  packagingType?: "normal" | "blown-moulded";
  soldByDimensions?: boolean;
  barcode?: string;
};

export type Declaration = {
  rule: string;
  name: string;
  explanation: string;
  found: string;
  status: DeclarationStatus;
};

export type ComplianceResult = {
  verdict: Verdict;
  verdictLabel: "✓ Compliant" | "⚠ Needs Review" | "✗ Non-Compliant";
  matchScore: number;
  declarations: Declaration[];
  quantity: {
    declared: number;
    measured: number | null;
    unit: string;
    deficit: number | null;
    allowableShortfall: number | null;
    tolerance: "PASS" | "FAIL" | "NOT_CHECKED";
  };
  pricing: {
    mrp: number | null;
    catalogPrice: number | null;
    unitSalePrice: number | null;
    unitLabel: string;
    mrpSyntax: "VALID" | "ILLEGAL" | "MISSING";
    catalogMatch: boolean | null;
  };
  expiry: { date: string | null; daysRemaining: number | null; risk: RiskStatus | "NOT_CHECKED" };
  barcode: { value: string | null; type: "EAN-13" | "UPC-A" | "UNKNOWN"; checkDigitValid: boolean | null; grade: string | null };
  criticalIssues: string[];
};

const PIN = /\b[1-9][0-9]{5}\b/;
const ORIGIN = /(?:country\s+of\s+origin\s*:\s*|made\s+in\s+)([a-z][a-z .'-]+)/i;
const DIMENSIONS = /\b\d+(?:\.\d+)?\s*[×x*]\s*\d+(?:\.\d+)?\s*[×x*]\s*\d+(?:\.\d+)?\s*(?:mm|cm)\b/i;
const PHONE = /(?:\+?91[-\s]?)?(?:1800\d{7,10}|0\d{2,4}[-\s]?\d{6,8}|\d{10})/;
const EMAIL = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/;

function parseDate(input?: string): Date | null {
  if (!input) return null;
  const direct = new Date(input);
  if (!Number.isNaN(direct.getTime())) return direct;
  const match = input.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (match) return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
  const monthYear = input.match(/^(\d{1,2})[/-](\d{4})$/);
  if (monthYear) return new Date(Number(monthYear[2]), Number(monthYear[1]), 0);
  return null;
}

export function allowableShortfall(qn: number): number {
  if (qn <= 50) return qn * 0.09;
  if (qn <= 100) return 4.5;
  if (qn <= 200) return qn * 0.045;
  if (qn <= 300) return 9;
  if (qn <= 500) return qn * 0.03;
  if (qn <= 1000) return 15;
  return qn * 0.015;
}

export function requiredFontHeightMm(quantity: number, packaging: "normal" | "blown-moulded" = "normal"): number {
  const multiplier = packaging === "blown-moulded" ? 2 : 1;
  if (quantity <= 50) return 1.5 * multiplier;
  if (quantity <= 200) return 2 * multiplier;
  if (quantity <= 1000) return 4 * multiplier;
  return 6 * multiplier;
}

function makeDeclaration(rule: string, name: string, explanation: string, found: string, status: DeclarationStatus): Declaration {
  return { rule, name, explanation, found, status };
}

function validateBarcode(value?: string): ComplianceResult["barcode"] {
  if (!value) return { value: null, type: "UNKNOWN", checkDigitValid: null, grade: null };
  const digits = value.replace(/\D/g, "");
  const type = digits.length === 13 ? "EAN-13" : digits.length === 12 ? "UPC-A" : "UNKNOWN";
  if (type === "UNKNOWN") return { value, type, checkDigitValid: false, grade: "F" };
  const body = digits.slice(0, -1).split("").map(Number);
  const weighted = body.reduce((sum, digit, index) => sum + digit * (type === "EAN-13" ? (index % 2 === 0 ? 1 : 3) : (index % 2 === 0 ? 3 : 1)), 0);
  const expected = (10 - (weighted % 10)) % 10;
  const valid = expected === Number(digits.at(-1));
  return { value, type, checkDigitValid: valid, grade: valid ? "A (3.5/4.0)" : "F (0.0/4.0)" };
}

export function evaluateCompliance(input: ComplianceInput): ComplianceResult {
  const unit = input.quantityUnit ?? "g";
  const declared = Number(input.declaredNetQuantity) || 0;
  const declaredBase = /^(kg|L)$/i.test(unit) ? declared * 1000 : declared;
  const measured = input.scaleNetWeight == null ? null : Number(input.scaleNetWeight);
  const tolerance = measured == null ? "NOT_CHECKED" : (declaredBase - measured <= allowableShortfall(declaredBase) ? "PASS" : "FAIL");
  const deficit = measured == null ? null : Math.max(0, declaredBase - measured);
  const mrpText = input.mrpText ?? (input.mrp == null ? "" : `MRP ₹${input.mrp}`);
  const mrpValue = typeof input.mrp === "number" ? input.mrp : typeof input.mrp === "string" ? Number(input.mrp.replace(/[^\d.]/g, "")) : null;
  const mrpSyntax = !mrpText ? "MISSING" : /inclusive\s+of\s+all\s+taxes/i.test(mrpText) && !/(taxes?\s+extra|local\s+taxes?\s+applicable)/i.test(mrpText) ? "VALID" : "ILLEGAL";
  const unitSalePrice = mrpValue != null && declared > 0 ? mrpValue / declared : null;
  const unitLabel = unit === "kg" || unit === "L" ? `₹/${unit}` : `₹/${unit}`;
  const expiryDate = parseDate(input.expiryDate);
  const daysRemaining = expiryDate ? Math.ceil((expiryDate.getTime() - Date.now()) / 86400000) : null;
  const expiryRisk: ComplianceResult["expiry"]["risk"] = expiryDate == null ? "NOT_CHECKED" : daysRemaining! <= 0 ? "CRITICAL_EXPIRED" : daysRemaining! <= 30 ? "MODERATE_RISK" : "LOW_RISK";
  const requiredHeight = requiredFontHeightMm(declaredBase, input.packagingType);
  const addressOkay = Boolean(input.manufacturerAddress && PIN.test(input.manufacturerAddress));
  const careText = input.consumerCare ?? "";
  const careOkay = Boolean(careText && PHONE.test(careText) && EMAIL.test(careText));
  const countryOkay = Boolean((input.countryOfOrigin && input.countryOfOrigin.trim()) || ORIGIN.test(input.productName ?? ""));
  const productOkay = Boolean(input.productName?.trim());
  const qtyOkay = declared > 0 && Boolean(unit.match(/^(g|kg|ml|L|m|cm|N)$/i));
  const fontOkay = input.netQuantityFontHeightMm == null || input.netQuantityFontHeightMm >= requiredHeight;
  const manufactureOkay = Boolean(input.mfgDate && /^(?:\d{1,2}[/-]\d{4}|[A-Za-z]{3}\s+\d{4})$/.test(input.mfgDate));
  const expiryOkay = Boolean(input.expiryDate && expiryDate);
  const uspOkay = unitSalePrice != null && unitSalePrice > 0;
  const dimensionsApplicable = input.soldByDimensions === true;
  const dimensionsOkay = !dimensionsApplicable || Boolean(input.dimensions && DIMENSIONS.test(input.dimensions));
  const barcode = validateBarcode(input.barcode);

  const declarations = [
    makeDeclaration("6(1)(a)", "Manufacturer / packer / importer", "Company and premises address must carry a valid six-digit PIN.", input.manufacturerAddress ?? "No address captured", addressOkay ? "PRESENT" : "MISSING"),
    makeDeclaration("6(1)(aa)", "Country of origin", "Imported goods identify the country where the commodity was made.", input.countryOfOrigin ? `Country of Origin: ${input.countryOfOrigin}` : "No origin statement captured", countryOkay ? "PRESENT" : "MISSING"),
    makeDeclaration("6(1)(b)", "Commodity name", "The principal display panel states an unambiguous generic name.", input.productName ?? "No product name captured", productOkay ? "PRESENT" : "MISSING"),
    makeDeclaration("6(1)(c)", "Net quantity", "Numeric quantity and metric unit must be legible at Fourth Schedule height.", `${declared || "—"} ${unit}`, qtyOkay && fontOkay ? "PRESENT" : qtyOkay ? "UNDERSIZED" : "ILLEGAL_SYNTAX"),
    makeDeclaration("6(1)(d)", "Month / year of manufacture", "Manufacture date is shown as MM/YYYY, MM-YYYY, or MMM YYYY.", input.mfgDate ?? "No manufacture date captured", manufactureOkay ? "PRESENT" : "MISSING"),
    makeDeclaration("6(1)(e)", "Best-before / expiry", "The date declaration must be parseable so remaining shelf life can be calculated.", input.expiryDate ? `Expiry: ${input.expiryDate}` : "No expiry captured", expiryOkay ? "PRESENT" : "MISSING"),
    makeDeclaration("6(1)(f)", "Maximum retail price", "MRP must state that all taxes are included; tax-extra syntax is rejected.", mrpText || "No MRP captured", mrpSyntax === "VALID" ? "PRESENT" : mrpSyntax === "ILLEGAL" ? "ILLEGAL_SYNTAX" : "MISSING"),
    makeDeclaration("6(11)", "Unit sale price", "USP is derived from MRP divided by declared quantity and must be declared.", uspOkay ? `₹${unitSalePrice!.toFixed(2)}/${unit}` : "USP missing", uspOkay ? "PRESENT" : "MISSING"),
    makeDeclaration("6(1)(h)", "Consumer care", "Designation, postal address, phone and email give the consumer a traceable contact.", careText || "No consumer-care line captured", careOkay ? "PRESENT" : "MISSING"),
    makeDeclaration("6(1)(j)", "Dimensions", "Length × width × height is required only when the commodity is sold by length or area.", dimensionsApplicable ? (input.dimensions ?? "No dimensions captured") : "Not sold by length / area", dimensionsOkay ? (dimensionsApplicable ? "PRESENT" : "NA") : "MISSING"),
  ];

  const criticalIssues: string[] = [];
  if (!addressOkay) criticalIssues.push("Rule 6(1)(a): manufacturer address or six-digit PIN is missing.");
  if (!countryOkay) criticalIssues.push("Rule 6(1)(aa): country-of-origin statement is missing.");
  if (mrpSyntax !== "VALID") criticalIssues.push(`Rule 6(1)(f): MRP syntax is ${mrpSyntax.toLowerCase()}.`);
  if (!uspOkay) criticalIssues.push("Rule 6(11): unit sale price is missing.");
  if (tolerance === "FAIL") criticalIssues.push("Section 36: measured quantity exceeds the Second Schedule shortfall.");
  if (expiryRisk === "CRITICAL_EXPIRED") criticalIssues.push("Expiry date is past; product is expired.");
  if (barcode.checkDigitValid === false) criticalIssues.push("Barcode check digit or symbology is invalid.");
  const present = declarations.filter(d => d.status === "PRESENT" || d.status === "NA").length;
  let matchScore = Math.round((present / declarations.length) * 100);
  if (mrpSyntax === "ILLEGAL") matchScore -= 12;
  if (!uspOkay) matchScore -= 12;
  if (tolerance === "FAIL") matchScore -= 18;
  if (expiryRisk === "CRITICAL_EXPIRED") matchScore -= 18;
  if (!countryOkay) matchScore -= 5;
  matchScore = Math.max(0, Math.min(100, matchScore));
  const verdict: Verdict = criticalIssues.some(issue => /MRP|unit sale|expired|Section 36|six-digit PIN|origin/i.test(issue)) || matchScore < 60 ? "NON_COMPLIANT" : matchScore >= 90 ? "COMPLIANT" : "NEEDS_REVIEW";

  return {
    verdict,
    verdictLabel: verdict === "COMPLIANT" ? "✓ Compliant" : verdict === "NEEDS_REVIEW" ? "⚠ Needs Review" : "✗ Non-Compliant",
    matchScore,
    declarations,
    quantity: { declared, measured, unit, deficit, allowableShortfall: declared ? allowableShortfall(declaredBase) : null, tolerance },
    pricing: { mrp: mrpValue, catalogPrice: input.catalogPrice ?? null, unitSalePrice, unitLabel, mrpSyntax, catalogMatch: input.catalogPrice == null || mrpValue == null ? null : Math.abs(input.catalogPrice - mrpValue) < 0.01 },
    expiry: { date: input.expiryDate ?? null, daysRemaining, risk: expiryRisk },
    barcode,
    criticalIssues,
  };
}
