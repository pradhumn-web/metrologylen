import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Verdict = "COMPLIANT" | "NEEDS_REVIEW" | "NON_COMPLIANT";
type Fixture = {
  id: string;
  label: string;
  declared: string;
  measured: string;
  mrp: string;
  usp: string;
  ingredients: string;
  score: number;
  verdict: Verdict;
  verdictText: string;
  reason: string;
  flags: Array<{ text: string; tone: "pass" | "review" | "fail" }>;
};

type Declaration = { rule: string; name: string; explanation: string; found: string; status: string };
type RiskRecord = { id?: string; name: string; level?: string; tone?: string; reason: string; score: number };
type AllergenRecord = { id: string; name: string; present: boolean; matchedKeywords: string[]; severity: string };
type IngredientRow = { name: string; category: string; signal: string; tone: "pass" | "review" | "fail" };
type Dossier = {
  compliance: {
    verdict: Verdict;
    verdictLabel: string;
    matchScore: number;
    declarations: Declaration[];
    quantity: { declared: number; measured: number | null; unit: string; deficit: number | null; allowableShortfall: number | null; tolerance: string };
    pricing: { mrp: number | null; unitSalePrice: number | null; unitLabel: string; mrpSyntax: string };
    expiry: { date: string | null; daysRemaining: number | null; risk: string };
    criticalIssues: string[];
  };
  health: {
    ingredientText?: string;
    allergens: Array<{ id: string; name: string; present: boolean; matchedKeywords: string[]; severity: string }>;
    chronicRisks: RiskRecord[];
    statutoryLine: string;
    additives: Array<{ code: string; name: string; functionalClass: string; clinicalRisk: string }>;
  };
  ocr?: { text: string; panels: string[]; boxes: Array<{ text: string; confidence: number }> } | null;
  productName?: string;
};

function parseIngredientRows(text: string, allergens: AllergenRecord[], additives: Array<{ code: string; name: string }>): IngredientRow[] {
  const allergenTerms = allergens.filter(item => item.present).flatMap(item => item.matchedKeywords.map(keyword => ({ keyword: keyword.toLowerCase(), name: item.name })));
  return text.replace(/^ingredients?\s*:\s*/i, "").split(/[;,]/).map(item => item.trim().replace(/\.$/, "")).filter(Boolean).map(name => {
    const lower = name.toLowerCase();
    const additive = additives.find(item => lower.includes(item.code.toLowerCase()) || lower.includes(item.name.toLowerCase()));
    const allergen = allergenTerms.find(item => lower.includes(item.keyword));
    const category = additive ? "Additive" : /oil|fat|palm|butter|ghee/i.test(name) ? "Oil / fat" : /sugar|syrup|sweetener/i.test(name) ? "Sugar" : /salt|sodium/i.test(name) ? "Salt / sodium" : /water|potato|rice|wheat|flour|oat|coriander|cumin/i.test(name) ? "Base ingredient" : "Other";
    if (allergen) return { name, category, signal: `Allergen · ${allergen.name}`, tone: "fail" as const };
    if (additive) return { name, category, signal: `Additive · ${additive.code}`, tone: "review" as const };
    if (/sugar|salt|oil|fat|palm/i.test(name)) return { name, category, signal: "Health signal", tone: "review" as const };
    return { name, category, signal: "Declared", tone: "pass" as const };
  });
}

const declarationRuleIds = ["6(1)(a)", "6(1)(aa)", "6(1)(b)", "6(1)(c)", "6(1)(d)", "6(1)(e)", "6(1)(f)", "6(11)", "6(1)(h)"] as const;

function checklistFromDossier(dossier: Dossier): boolean[] {
  const declarations = dossier.compliance.declarations ?? [];
  const declarationChecks = declarationRuleIds.map(rule => declarations.find(row => row.rule === rule)?.status.toUpperCase().includes("PRESENT") ?? false);
  const ocrText = `${dossier.ocr?.text ?? ""} ${(dossier.ocr?.panels ?? []).join(" ")}`;
  const barcodeEvidence = declarations.some(row => /barcode|batch|lot|trace/i.test(`${row.name} ${row.found}`) && !/missing|unknown|not found/i.test(row.status)) || /barcode|batch|lot|trace|\b\d{8,14}\b/i.test(ocrText);
  return [...declarationChecks, barcodeEvidence];
}

const fixtures: Fixture[] = [
  { id: "chips-lays", label: "Lay's chips", declared: "52 g", measured: "53 g", mrp: "₹20.00", usp: "₹0.38/g", ingredients: "Potatoes, Edible Vegetable Oil (Palmolein), Iodised Salt.", score: 96, verdict: "COMPLIANT", verdictText: "✓ COMPLIANT", reason: "Mandatory declarations present; measured quantity is inside the 4.5 g MPE.", flags: [{ text: "NO ALLERGENS", tone: "pass" }, { text: "SALT · WARNING", tone: "review" }, { text: "PALMOLEIN · DANGER", tone: "fail" }] },
  { id: "chips-bingo", label: "Bingo! chips", declared: "90 g", measured: "91 g", mrp: "₹50.00", usp: "₹0.56/g", ingredients: "Potatoes, Edible Vegetable Oil, Iodised Salt, Spices, Acidity Regulator (INS 330).", score: 94, verdict: "COMPLIANT", verdictText: "✓ COMPLIANT", reason: "Declarations pass; salt and additive signals require health review.", flags: [{ text: "NO ALLERGENS", tone: "pass" }, { text: "SALT · WARNING", tone: "review" }, { text: "INS 330 · REVIEW", tone: "review" }] },
  { id: "chips-balaji", label: "Balaji wafers", declared: "55 g", measured: "54 g", mrp: "₹20.00", usp: "₹0.36/g", ingredients: "Potatoes, Palmolein Oil, Salt, Sugar, Spices. Contains Milk Solids.", score: 88, verdict: "NEEDS_REVIEW", verdictText: "⚠ NEEDS REVIEW", reason: "Quantity is within tolerance; milk declaration and sodium signals need review.", flags: [{ text: "DAIRY · CRITICAL", tone: "fail" }, { text: "SALT · WARNING", tone: "review" }, { text: "PALMOLEIN · REVIEW", tone: "review" }] },
  { id: "chips-tooyumm", label: "Too Yumm! chips", declared: "70 g", measured: "68 g", mrp: "₹35.00", usp: "₹0.50/g", ingredients: "Potatoes, Rice Bran Oil, Salt, Chilli, Acidity Regulator (INS 330).", score: 91, verdict: "COMPLIANT", verdictText: "✓ COMPLIANT", reason: "Declarations pass and measured quantity remains inside the 3.5 g MPE.", flags: [{ text: "NO MAJOR ALLERGEN", tone: "pass" }, { text: "SALT · WARNING", tone: "review" }, { text: "INS 330 · REVIEW", tone: "review" }] },
  { id: "chips-unclechipps", label: "Uncle Chipps", declared: "55 g", measured: "55 g", mrp: "₹20.00", usp: "₹0.36/g", ingredients: "Potatoes, Edible Vegetable Oil, Salt, Sugar, Spices. Contains Soy.", score: 86, verdict: "NEEDS_REVIEW", verdictText: "⚠ NEEDS REVIEW", reason: "Soy allergen and sugar/sodium signals require a health review.", flags: [{ text: "SOY · CRITICAL", tone: "fail" }, { text: "SUGAR · WARNING", tone: "review" }, { text: "SALT · WARNING", tone: "review" }] },
];
const chipAliases: Record<string, string[]> = {
  "chips-lays": ["lays", "lay's", "classic salted"],
  "chips-bingo": ["bingo", "mad angles"],
  "chips-balaji": ["balaji", "wafers"],
  "chips-tooyumm": ["too yumm", "tooyumm"],
  "chips-unclechipps": ["uncle chipps", "uncle chips"],
};
function matchChipFixture(value: string) {
  const normalized = value.toLowerCase();
  return fixtures.find(fixture => normalized.includes(fixture.label.toLowerCase()) || (chipAliases[fixture.id] ?? []).some(alias => normalized.includes(alias))) ?? null;
}
const metrologyRules = [
  ["R1", "Manufacturer / packer / importer", "Name and complete postal address"],
  ["R2", "Country of origin", "Required for imported commodities"],
  ["R3", "Generic commodity name", "Clear principal display panel name"],
  ["R4", "Net quantity", "Metric quantity and correct unit"],
  ["R5", "Manufacture / pack date", "Month and year declaration"],
  ["R6", "Best-before / expiry", "Readable date or shelf-life statement"],
  ["R7", "Maximum retail price", "MRP inclusive of all taxes"],
  ["R8", "Unit sale price", "Derived price per standard unit"],
  ["R9", "Consumer care", "Phone, email, and postal contact"],
  ["R10", "Barcode / traceability", "Barcode, batch, or lot reference"],
] as const;

const productRuleChecks: Record<string, boolean[]> = {
  "chips-lays": [true, true, true, true, true, true, true, true, true, true],
  "chips-bingo": [true, true, true, true, true, true, true, true, true, true],
  "chips-balaji": [true, true, true, true, true, true, true, true, true, true],
  "chips-tooyumm": [true, true, true, true, true, true, true, true, true, true],
  "chips-unclechipps": [true, true, true, true, true, true, true, true, true, true],
};

const staticDeclarations: Declaration[] = [
  { rule: "6(1)(a)", name: "Manufacturer / packer / importer", explanation: "Company and premises address must carry a valid six-digit PIN.", found: "GrainWorks Foods Pvt Ltd · Pune 411001", status: "✓ PRESENT" },
  { rule: "6(1)(aa)", name: "Country of origin", explanation: "Imported goods identify the country where the commodity was made.", found: "Country of Origin: India", status: "✓ PRESENT" },
  { rule: "6(1)(b)", name: "Commodity name", explanation: "The principal display panel states an unambiguous generic name.", found: "Classic Besan Sev", status: "✓ PRESENT" },
  { rule: "6(1)(c)", name: "Net quantity", explanation: "Numeric quantity and metric unit must be legible at Fourth Schedule height.", found: "200 g · 2.0 mm", status: "✓ PRESENT" },
  { rule: "6(1)(d)", name: "Month / year of manufacture", explanation: "Manufacture date is shown as MM/YYYY, MM-YYYY, or MMM YYYY.", found: "06/2026", status: "✓ PRESENT" },
  { rule: "6(1)(e)", name: "Best-before / expiry", explanation: "The date declaration must be parseable for shelf-life calculation.", found: "Best Before 9 Months", status: "✓ PRESENT" },
  { rule: "6(1)(f)", name: "Maximum retail price", explanation: "MRP must state that all taxes are included.", found: "Rs 60/- (Taxes extra)", status: "✗ ILLEGAL SYNTAX" },
  { rule: "6(11)", name: "Unit sale price", explanation: "USP is derived from MRP divided by declared quantity and must be declared.", found: "USP missing", status: "✗ MISSING" },
  { rule: "6(1)(h)", name: "Consumer care", explanation: "Designation, postal address, phone and email provide traceability.", found: "care@grainworks.in · 18001234567", status: "✓ PRESENT" },
  { rule: "6(1)(j)", name: "Dimensions", explanation: "Required only when the commodity is sold by length or area.", found: "Not sold by length / area", status: "— N/A" },
];

const staticRisks: RiskRecord[] = [
  { name: "Hypertension & CVD", score: 94, tone: "fail", reason: "Salt + MSG (INS 621) + sodium bicarbonate (INS 500(ii))." },
  { name: "Atherosclerosis & lipids", score: 86, tone: "fail", reason: "Refined palmolein oil detected in the ingredient line." },
  { name: "Diabetes mellitus", score: 18, tone: "review", reason: "No sugar or syrup keyword detected." },
  { name: "Celiac disease", score: 0, tone: "pass", reason: "No gluten keyword in the worked fixture." },
];

const allergenCatalog: Array<[string, string, string]> = [
  ["gluten", "Gluten", "critical"], ["dairy", "Dairy", "critical"], ["peanuts_tree_nuts", "Peanuts / tree nuts", "critical"],
  ["soy", "Soy", "critical"], ["eggs", "Eggs", "critical"], ["fish_shellfish", "Fish / shellfish", "critical"],
  ["sesame", "Sesame", "moderate"], ["mustard", "Mustard", "moderate"], ["sulfites", "Sulfites", "moderate"],
];

function productAllergens(present: Record<string, string[]>): AllergenRecord[] {
  return allergenCatalog.map(([id, name, severity]) => ({ id, name, severity, present: Boolean(present[id]), matchedKeywords: present[id] ?? [] }));
}

const verdictProfiles: Record<string, { allergens: AllergenRecord[]; risks: RiskRecord[]; statutoryLine: string }> = {
  "oats-500g": { allergens: productAllergens({ gluten: ["gluten", "oats"] }), risks: [{ name: "Celiac disease", score: 88, tone: "fail", reason: "Gluten declaration detected in the oat ingredient panel." }, { name: "Hypertension & CVD", score: 4, tone: "pass", reason: "No sodium-loaded ingredient signal found." }, { name: "Diabetes mellitus", score: 12, tone: "pass", reason: "No added sugar or syrup keyword detected." }, { name: "Atherosclerosis & lipids", score: 3, tone: "pass", reason: "No palm or hydrogenated fat signal found." }], statutoryLine: "ALLERGEN DECLARATION: Contains Gluten. Sensitive consumers should exercise caution." },
  "rice-5kg": { allergens: productAllergens({}), risks: [{ name: "Celiac disease", score: 0, tone: "pass", reason: "No gluten keyword detected." }, { name: "Hypertension & CVD", score: 0, tone: "pass", reason: "No sodium-loaded ingredient signal found." }, { name: "Diabetes mellitus", score: 0, tone: "pass", reason: "No added sugar signal found." }, { name: "Atherosclerosis & lipids", score: 0, tone: "pass", reason: "No palm or hydrogenated fat signal found." }], statutoryLine: "ALLERGEN DECLARATION: No declared allergen keyword detected." },
  "namkeen-noncompliant": { allergens: productAllergens({ soy: ["soy"], sulfites: ["INS 150d"] }), risks: staticRisks, statutoryLine: "ALLERGEN DECLARATION: Contains Soy, Sulfites. Sensitive consumers must exercise strict caution." },
  "spices-expired": { allergens: productAllergens({ mustard: ["mustard seeds"], sulfites: ["INS 211"] }), risks: [{ name: "Hypertension & CVD", score: 42, tone: "review", reason: "Salt and preservative signal in the spice blend." }, { name: "Diabetes mellitus", score: 2, tone: "pass", reason: "No added sugar signal detected." }, { name: "Celiac disease", score: 0, tone: "pass", reason: "No gluten keyword detected." }, { name: "Mustard sensitivity", score: 76, tone: "fail", reason: "Mustard Seeds are explicitly listed." }], statutoryLine: "ALLERGEN DECLARATION: Contains Mustard and Sulfites." },
  "lays-chips": { allergens: productAllergens({}), risks: [{ name: "Hypertension & CVD", score: 68, tone: "review", reason: "Iodised salt is declared in a savoury snack." }, { name: "Atherosclerosis & lipids", score: 72, tone: "fail", reason: "Palmolein oil is declared." }, { name: "Diabetes mellitus", score: 8, tone: "pass", reason: "No sugar or syrup keyword detected." }, { name: "Celiac disease", score: 0, tone: "pass", reason: "No gluten keyword detected." }], statutoryLine: "ALLERGEN DECLARATION: No major allergen keyword detected; salt and palmolein advisories apply." },
  "parle-g-biscuit": { allergens: productAllergens({ gluten: ["wheat flour", "maida"], dairy: ["milk solids"] }), risks: [{ name: "Celiac disease", score: 91, tone: "fail", reason: "Wheat Flour (Maida) is explicitly listed." }, { name: "Lactose intolerance", score: 64, tone: "review", reason: "Milk Solids are declared." }, { name: "Diabetes mellitus", score: 78, tone: "fail", reason: "Sugar and invert syrup are declared." }, { name: "Atherosclerosis & lipids", score: 55, tone: "review", reason: "Palmolein oil is declared." }], statutoryLine: "ALLERGEN DECLARATION: Contains Wheat (Gluten) and Milk Solids." },
  "fizz-softdrink": { allergens: productAllergens({ sulfites: ["INS 211"] }), risks: [{ name: "Diabetes mellitus", score: 96, tone: "fail", reason: "Sugar is a primary ingredient in the soft drink." }, { name: "Hypertension & CVD", score: 18, tone: "review", reason: "Carbonated beverage and preservative signal detected." }, { name: "Celiac disease", score: 0, tone: "pass", reason: "No gluten keyword detected." }, { name: "Sulfite sensitivity", score: 44, tone: "review", reason: "Preservative INS 211 is declared." }], statutoryLine: "ALLERGEN DECLARATION: Sulfite preservative detected; added sugar advisory applies." },
};
const chipsProfiles: Record<string, { allergens: AllergenRecord[]; risks: RiskRecord[]; statutoryLine: string }> = {
  "chips-lays": { allergens: productAllergens({}), risks: [{ name: "Hypertension & CVD", score: 68, tone: "review", reason: "Iodised salt is declared in the savoury chips." }, { name: "Atherosclerosis & lipids", score: 72, tone: "fail", reason: "Palmolein oil is declared." }, { name: "Diabetes mellitus", score: 8, tone: "pass", reason: "No sugar keyword detected." }, { name: "Celiac disease", score: 0, tone: "pass", reason: "No gluten keyword detected." }], statutoryLine: "ALLERGEN DECLARATION: No major allergen keyword detected; salt and palmolein advisories apply." },
  "chips-bingo": { allergens: productAllergens({}), risks: [{ name: "Hypertension & CVD", score: 55, tone: "review", reason: "Iodised salt is declared." }, { name: "Additive sensitivity", score: 28, tone: "review", reason: "Acidity regulator INS 330 is declared." }, { name: "Diabetes mellitus", score: 12, tone: "pass", reason: "No added sugar keyword detected." }, { name: "Celiac disease", score: 0, tone: "pass", reason: "No gluten keyword detected." }], statutoryLine: "ALLERGEN DECLARATION: No major allergen keyword detected." },
  "chips-balaji": { allergens: productAllergens({ dairy: ["milk solids"] }), risks: [{ name: "Lactose intolerance", score: 72, tone: "fail", reason: "Milk Solids are explicitly declared." }, { name: "Hypertension & CVD", score: 61, tone: "review", reason: "Salt is declared in the snack seasoning." }, { name: "Atherosclerosis & lipids", score: 69, tone: "fail", reason: "Palmolein oil is declared." }, { name: "Diabetes mellitus", score: 36, tone: "review", reason: "Sugar is present in the ingredient line." }], statutoryLine: "ALLERGEN DECLARATION: Contains Milk Solids." },
  "chips-tooyumm": { allergens: productAllergens({}), risks: [{ name: "Hypertension & CVD", score: 48, tone: "review", reason: "Salt is declared." }, { name: "Additive sensitivity", score: 28, tone: "review", reason: "Acidity regulator INS 330 is declared." }, { name: "Diabetes mellitus", score: 0, tone: "pass", reason: "No sugar keyword detected." }, { name: "Celiac disease", score: 0, tone: "pass", reason: "No gluten keyword detected." }], statutoryLine: "ALLERGEN DECLARATION: No major allergen keyword detected." },
  "chips-unclechipps": { allergens: productAllergens({ soy: ["soy"] }), risks: [{ name: "Soy sensitivity", score: 82, tone: "fail", reason: "Soy is explicitly declared." }, { name: "Hypertension & CVD", score: 57, tone: "review", reason: "Salt is declared." }, { name: "Diabetes mellitus", score: 31, tone: "review", reason: "Sugar is present in the ingredient line." }, { name: "Atherosclerosis & lipids", score: 38, tone: "review", reason: "Edible vegetable oil is declared." }], statutoryLine: "ALLERGEN DECLARATION: Contains Soy." },
};

function statusTone(status: string) {
  if (status.includes("PRESENT") || status.includes("N/A")) return "pass";
  if (status.includes("UNDERSIZED")) return "review";
  return "fail";
}

export default function Home() {
  const [activeId, setActiveId] = useState("chips-lays");
  const [live, setLive] = useState<Dossier | null>(null);
  const [scanState, setScanState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [capturedFrames, setCapturedFrames] = useState<Array<{ label: string; data: string }>>([]);
  const [ruleChecks, setRuleChecks] = useState<boolean[]>(() => productRuleChecks[activeId] ?? metrologyRules.map(() => false));
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [manual, setManual] = useState({ product_name: "", declared_net_quantity: "200", scale_net_weight: "197", mrp: "60", expiry_date: "2027-02-14" });
  const activeFixture = fixtures.find(f => f.id === activeId) ?? fixtures[2];
  const activeProfile = chipsProfiles[activeId] ?? verdictProfiles[activeId] ?? chipsProfiles["chips-lays"];
  const liveDeclarations = live?.compliance.declarations ?? staticDeclarations;
  const liveRisks: RiskRecord[] = live?.health.chronicRisks ?? activeProfile.risks;
  const liveAllergens: AllergenRecord[] = live?.health.allergens ?? activeProfile.allergens;
  const ingredientText = live?.health.ingredientText ?? activeFixture.ingredients;
  const ingredientRows = useMemo(() => parseIngredientRows(ingredientText, liveAllergens, live?.health.additives ?? []), [ingredientText, liveAllergens, live?.health.additives]);
  const activeVerdict = live ? { score: live.compliance.matchScore, text: live.compliance.verdictLabel, verdict: live.compliance.verdict, reason: live.compliance.criticalIssues[0] ?? "All critical fields present." } : { score: activeFixture.score, text: activeFixture.verdictText, verdict: activeFixture.verdict, reason: activeFixture.reason };
  const currentProductName = live?.productName ?? "Classic Besan Sev";

  useEffect(() => {
    if (!cameraOpen) return;
    let cancelled = false;
    setCameraError("");
    navigator.mediaDevices?.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then(stream => {
        if (cancelled) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => setCameraError("Camera access was blocked. Allow camera permission, or use the manual fallback below."));
    return () => { cancelled = true; streamRef.current?.getTracks().forEach(track => track.stop()); streamRef.current = null; };
  }, [cameraOpen]);

  useEffect(() => {
    if (!live) setRuleChecks(productRuleChecks[activeId] ?? metrologyRules.map(() => false));
  }, [activeId, live]);

  function openCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("This browser does not expose camera access. Use the manual fallback below.");
      setCameraOpen(true);
      return;
    }
    setCapturedFrames([]);
    setCameraOpen(true);
  }

  function closeCamera() {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    setCameraOpen(false);
  }

  function captureFrame() {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || video.videoWidth === 0) {
      setCameraError("The camera is still starting. Hold the package steady and try again.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const labels = ["Front PDP", "Ingredients panel", "Barcode / batch side"];
    const next = { label: labels[capturedFrames.length] ?? `Panel ${capturedFrames.length + 1}`, data: canvas.toDataURL("image/jpeg", 0.84) };
    setCapturedFrames(frames => [...frames, next]);
    setCameraError("");
  }

  async function runLiveScan(preset = activeId) {
    setScanState("loading");
    try {
      const images = capturedFrames.length > 0 ? capturedFrames.map(frame => frame.data) : ["fixture"];
      const response = await fetch("/api/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ images, mode: "full", batch_id: undefined, preset_fallback: preset }) });
      if (!response.ok) throw new Error("Scan failed");
      const dossier = await response.json() as Dossier;
      setLive(dossier);
      setRuleChecks(checklistFromDossier(dossier));
      setScanState("done");
      closeCamera();
    } catch {
      setScanState("error");
    }
  }

  async function runManualAudit(event: FormEvent) {
    event.preventDefault();
    setScanState("loading");
    try {
      const response = await fetch("/api/manual-audit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(manual) });
      if (!response.ok) throw new Error("Manual audit failed");
      const dossier = await response.json() as Dossier;
      const matchedFixture = matchChipFixture(manual.product_name);
      if (matchedFixture) setActiveId(matchedFixture.id);
      setLive(dossier);
      setRuleChecks(checklistFromDossier(dossier));
      setScanState("done");
    } catch {
      setScanState("error");
    }
  }

  function downloadChecklistReport() {
    const escapeCsv = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const declarations = live?.compliance.declarations ?? [];
    const rows = metrologyRules.map(([code, title, detail], index) => {
      const ruleId = declarationRuleIds[index];
      const declaration = ruleId ? declarations.find(row => row.rule === ruleId) : undefined;
      const evidence = declaration?.found ?? (index === 9 ? (live?.ocr?.text.match(/(?:barcode|batch|lot)[^\n]*/i)?.[0] ?? "OCR traceability panel captured") : "Manual review required");
      return [code, title, detail, ruleChecks[index] ? "CHECKED" : "NOT CHECKED", evidence, declaration?.status ?? (live ? "OCR EVIDENCE" : "MANUAL")];
    });
    const metadata = [
      ["MetrologyLens compliance report"],
      ["Product", currentProductName],
      ["Verdict", activeVerdict.text],
      ["Match score", `${activeVerdict.score}/100`],
      ["Checklist source", checklistSource],
      ["Generated", new Date().toISOString()],
      [],
      ["Rule", "Requirement", "Check", "Status", "Evidence", "Detection status"],
      ...rows,
    ];
    const csv = metadata.map(row => row.map(escapeCsv).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${currentProductName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "product"}-compliance-report.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  const displayedQuantity = live ? `${live.compliance.quantity.declared} ${live.compliance.quantity.unit}` : activeFixture.declared;
  const displayedMeasured = live?.compliance.quantity.measured != null ? `${live.compliance.quantity.measured} g` : activeFixture.measured;
  const displayedMrp = live?.compliance.pricing.mrp != null ? `₹${live.compliance.pricing.mrp.toFixed(2)}` : activeFixture.mrp;
  const displayedUsp = live?.compliance.pricing.unitSalePrice != null ? `₹${live.compliance.pricing.unitSalePrice.toFixed(2)}${live.compliance.pricing.unitLabel.replace("₹", "")}` : activeFixture.usp;
  const riskMax = useMemo(() => Math.max(...liveRisks.map(r => r.score), 1), [liveRisks]);
  const checkedRules = ruleChecks.filter(Boolean).length;
  const checklistSource = live ? "OCR AUTO-POPULATED · EDITABLE" : `PRODUCT VERDICT · ${activeFixture.label.toUpperCase()}`;

  return (
    <div className="metrology-page">
      <div className="ruler ruler-left" aria-hidden="true" />
      <div className="ruler ruler-right" aria-hidden="true" />
      <header className="file-strip"><span>LEGAL METROLOGY ACT, 2009 · PCR 2011 (AMD. 2023) · FSSAI REG. 2.4.5</span><span>ENGINE REV. 0.8.4 · BUILD 2026.09</span></header>
      <main className="document-shell">
        <nav className="masthead" aria-label="Primary navigation">
          <a className="wordmark" href="#top" aria-label="MetrologyLens home">Metrology<span>Lens</span></a>
          <div className="nav-links"><a href="#declarations">Declarations</a><a href="#verdicts">Verdicts</a><a href="#allergens">Health scan</a></div>
          <a className="nav-console" href="#console">Open console <span>↗</span></a>
        </nav>

        <section className="hero-section" id="top">
          <div className="hero-copy"><p className="section-kicker">A field instrument for printed truth</p><h1>Read the label.<br /><em>Measure the claim.</em></h1><p className="hero-lede">MetrologyLens turns a photographed package into a traceable inspection dossier: declarations, scale tolerance, pricing syntax, ingredients, allergens and health signals in one pass.</p><p className="citation">PCR 2011 · RULE 6(1) · SECOND SCHEDULE MPE · FSSAI 2.4.5</p><div className="hero-actions"><a className="button button-dark" href="#verdicts">See a sample dossier</a><a className="button button-line" href="#metrology-checklist">See the 10 rules</a></div></div>
          <div className="scan-mock" aria-label="Sample inspection dossier">
            <div className="scan-topline"><span>FORM VI-A · INSPECTION DOSSIER</span><span>ML–00418</span></div>
            <div className="mock-workspace"><div className="pouch-label"><div className="pouch-edge" /><span className="pouch-brand">GRAINWORKS</span><strong>CLASSIC<br />BESAN SEV</strong><small>CRISP · SAVOURY · 200 g</small><div className="pouch-seal">QC<br /><b>26</b></div><div className="pouch-lines" /></div><div className="ocr-box box-product"><span>COMMODITY NAME</span><b>96%</b></div><div className="ocr-box box-qty"><span>NET QTY</span><b>93%</b></div><div className="ocr-box box-mrp"><span>MRP</span><b>88%</b></div><div className="ocr-box box-stamp"><span>EXPIRY</span><b>61%</b></div></div>
            <div className="scan-readout"><span><i className="status-dot" />3 frames · 14 fields extracted</span><strong>1 statutory violation found</strong></div>
          </div>
        </section>

        <section className="console-section ruled-section" id="console"><div className="section-head"><h2>Scan console</h2><span>MODULE 0 · LIVE INPUT</span></div><div className="console-grid"><div className="console-run"><div><p className="eyebrow">Automated CV pipeline</p><h3>Scan the real package with your camera</h3><p>Capture the front panel, ingredients panel, and barcode or batch side. The frames are posted together as one inspection dossier.</p></div><div className="console-controls"><select aria-label="Fixture fallback" value={activeId} onChange={event => setActiveId(event.target.value)}>{fixtures.map(f => <option key={f.id} value={f.id}>{f.label} fallback</option>)}</select><button className="button button-dark" onClick={openCamera} disabled={scanState === "loading"}>{scanState === "loading" ? "Scanning…" : "Open camera"}</button><span className={`console-status ${scanState}`}>{scanState === "done" ? "API RESPONSE RECEIVED" : scanState === "error" ? "API UNAVAILABLE" : "CAMERA READY"}</span></div></div><form className="manual-form" onSubmit={runManualAudit}><div><p className="eyebrow">Manual fallback</p><h3>Torn or obscured label</h3></div><input aria-label="Product name" placeholder="Product name" value={manual.product_name} onChange={e => setManual({ ...manual, product_name: e.target.value })} /><input aria-label="Declared quantity" placeholder="Declared g" value={manual.declared_net_quantity} onChange={e => setManual({ ...manual, declared_net_quantity: e.target.value })} /><input aria-label="Measured quantity" placeholder="Measured g" value={manual.scale_net_weight} onChange={e => setManual({ ...manual, scale_net_weight: e.target.value })} /><input aria-label="MRP" placeholder="MRP ₹" value={manual.mrp} onChange={e => setManual({ ...manual, mrp: e.target.value })} /><button className="button button-line" type="submit" disabled={scanState === "loading"}>Audit manual fields</button></form></div>{cameraOpen && <div className="camera-panel" role="dialog" aria-modal="true" aria-labelledby="camera-title"><div className="camera-view"><video ref={videoRef} autoPlay playsInline muted aria-label="Live package camera preview" /><div className="camera-frame" aria-hidden="true" /><span className="camera-guide">Align {capturedFrames.length === 0 ? "front PDP" : capturedFrames.length === 1 ? "ingredients panel" : "barcode / batch side"} inside the frame</span></div><div className="camera-side"><div><p className="eyebrow">Camera capture · {capturedFrames.length}/3 panels</p><h3 id="camera-title">Build the inspection dossier</h3><p>Use even light. Keep text flat and fill the guide with one package panel at a time.</p></div><div className="capture-list">{["Front PDP", "Ingredients panel", "Barcode / batch side"].map((label, index) => <div className={`capture-item ${capturedFrames[index] ? "captured" : ""}`} key={label}><span>{capturedFrames[index] ? "✓" : String(index + 1).padStart(2, "0")}</span><strong>{label}</strong>{capturedFrames[index] && <small>frame ready</small>}</div>)}</div>{cameraError && <p className="camera-error" role="alert">{cameraError}</p>}<div className="camera-actions"><button className="button button-line" onClick={closeCamera}>Close camera</button><button className="button button-line" onClick={captureFrame} disabled={capturedFrames.length >= 3}>Capture panel</button><button className="button button-dark" onClick={() => runLiveScan()} disabled={capturedFrames.length === 0 || scanState === "loading"}>{scanState === "loading" ? "Sending…" : "Scan captured frames"}</button></div></div></div>}</section>

        <section className="ruled-section checklist-section" id="metrology-checklist"><div className="section-head"><h2>10-rule metrology check</h2><span>{checklistSource}</span></div><div className="checklist-summary"><div><strong>{checkedRules}/10</strong><span>rules checked</span></div><div className="checklist-progress"><i style={{ width: `${checkedRules * 10}%` }} /></div><div className="checklist-actions"><button className="button button-line" onClick={() => setRuleChecks(metrologyRules.map(() => false))}>Reset checklist</button><button className="button button-dark" onClick={downloadChecklistReport}>Download report</button></div></div><div className="metrology-checklist">{metrologyRules.map(([code, title, detail], index) => <label className={`rule-check ${ruleChecks[index] ? "checked" : ""}`} key={code}><input type="checkbox" checked={ruleChecks[index]} onChange={event => setRuleChecks(current => current.map((value, ruleIndex) => ruleIndex === index ? event.target.checked : value))} /><span className="rule-box" aria-hidden="true">{ruleChecks[index] ? "✓" : ""}</span><span className="rule-copy"><strong>{code} · {title}</strong><small>{detail}</small></span></label>)}</div></section>

        <section className="ruled-section" id="declarations"><div className="section-head"><h2>Declarations ledger</h2><span>RULE 6(1) · WORKED EXAMPLE / {currentProductName.toUpperCase()}</span></div><div className="ledger">{liveDeclarations.map(row => <div className="ledger-row" key={row.rule}><span className="rule-id">{row.rule}</span><div className="ledger-name"><strong>{row.name}</strong><span>{row.explanation}</span></div><code>{row.found}</code><span className={`ledger-status ${statusTone(row.status)}`}>{row.status}</span></div>)}</div></section>

        <section className="ruled-section" id="verdicts"><div className="section-head"><h2>Verdicts</h2><span>COMPANY DEMO DATASET · 5 CHIP BRANDS</span></div><div className="fixture-tabs" role="tablist" aria-label="Chips brand fixtures">{fixtures.map(f => <button key={f.id} role="tab" aria-selected={activeId === f.id} className={activeId === f.id ? "active" : ""} onClick={() => { setActiveId(f.id); setLive(null); setRuleChecks(metrologyRules.map(() => false)); }}>{f.label}</button>)}</div><div className="verdict-panel"><div className="fixture-data"><dl><div><dt>Declared / measured</dt><dd>{live ? displayedQuantity : activeFixture.declared} <span>/</span> {live ? displayedMeasured : activeFixture.measured}</dd></div><div><dt>MRP / unit sale price</dt><dd>{live ? displayedMrp : activeFixture.mrp} <span>/</span> {live ? displayedUsp : activeFixture.usp}</dd></div><div><dt>Ingredient read</dt><dd className="ingredient-read"><div className="ingredient-table" role="table" aria-label={`${activeFixture.label} ingredients`}><div className="ingredient-row ingredient-head" role="row"><span role="columnheader">Ingredient</span><span role="columnheader">Class</span><span role="columnheader">Signal</span></div>{ingredientRows.map(row => <div className="ingredient-row" role="row" key={`${row.name}-${row.category}`}><span role="cell">{row.name}</span><span role="cell">{row.category}</span><span role="cell" className={row.tone}>{row.signal}</span></div>)}</div></dd></div><div><dt>Match score</dt><dd className="score-read">{live ? live.compliance.matchScore : activeFixture.score}<span>/100</span></dd></div></dl><div className="flag-row">{activeFixture.flags.map(flag => <span key={flag.text} className={`flag-chip ${flag.tone}`}>{flag.text}</span>)}</div></div><div className={`ink-stamp ${activeVerdict.verdict === "COMPLIANT" ? "pass" : activeVerdict.verdict === "NEEDS_REVIEW" ? "review" : "fail"}`}><span>{activeVerdict.text}</span><small>{activeVerdict.reason}</small></div></div></section>

        <section className="ruled-section" id="allergens"><div className="section-head"><h2>Allergen & health risk</h2><span>FSSAI REG. 2.4.5 · {activeFixture.label.toUpperCase()}</span></div><div className="allergen-grid">{liveAllergens.map(allergen => <div className={`allergen-cell ${allergen.present ? "present" : "clear"}`} key={allergen.id}><div><strong>{allergen.name}</strong><span>{allergen.present ? allergen.severity.toUpperCase() : "NOT FOUND"}</span></div><p>{allergen.present ? `Matched ${allergen.matchedKeywords.join(", ")}.` : "No keyword match in this product’s ingredient read."}</p></div>)}</div><p className="statutory-line">{live?.health.statutoryLine ?? activeProfile.statutoryLine}</p><div className="risk-strip">{liveRisks.slice(0, 4).map(risk => <div className="risk-item" key={risk.id ?? risk.name}><div className="risk-label"><strong>{risk.name}</strong><span className={`risk-level ${risk.level ?? risk.tone ?? "low"}`}>{(risk.level ?? risk.tone ?? "low").toUpperCase()}</span></div><div className="risk-bar"><i className={risk.level ?? risk.tone ?? "low"} style={{ width: `${Math.round((risk.score / riskMax) * 100)}%` }} /></div><p>{risk.reason}</p></div>)}</div></section>

      </main>
      <footer className="site-footer"><span>Preview engine · not a substitute for statutory officer sign-off.</span><span>LEGAL METROLOGY ACT, 2009 · PCR 2011 · FSSAI REG. 2.4.5</span></footer>
      <nav className="mobile-app-nav" aria-label="App navigation"><a href="#console"><span>⌾</span><small>Scan</small></a><a href="#metrology-checklist"><span>☑</span><small>Rules</small></a><a href="#verdicts"><span>◈</span><small>Verdicts</small></a><a href="#allergens"><span>◇</span><small>Health</small></a></nav>
    </div>
  );
}
