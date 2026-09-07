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
    allergens: Array<{ id: string; name: string; present: boolean; matchedKeywords: string[]; severity: string }>;
    chronicRisks: RiskRecord[];
    statutoryLine: string;
    additives: Array<{ code: string; name: string; functionalClass: string; clinicalRisk: string }>;
  };
  productName?: string;
};

const fixtures: Fixture[] = [
  { id: "oats-500g", label: "oats-500g", declared: "500 g", measured: "502 g", mrp: "₹240.00", usp: "₹0.48/g", ingredients: "Whole Grain Rolled Oats (100%). Contains Gluten.", score: 100, verdict: "COMPLIANT", verdictText: "✓ COMPLIANT", reason: "All critical fields present; MPE within 15 g.", flags: [{ text: "GLUTEN", tone: "review" }, { text: "CELIAC · HIGH", tone: "fail" }, { text: "SODIUM · LOW", tone: "pass" }] },
  { id: "rice-5kg", label: "rice-5kg", declared: "5 kg", measured: "5018 g", mrp: "₹725.00", usp: "₹145.00/kg", ingredients: "100% Pure Aged Indian Basmati Rice.", score: 100, verdict: "COMPLIANT", verdictText: "✓ COMPLIANT", reason: "All critical fields present; MPE within 75 g.", flags: [{ text: "NO ALLERGENS", tone: "pass" }, { text: "VEGETARIAN", tone: "pass" }, { text: "LOW RISK", tone: "pass" }] },
  { id: "namkeen-noncompliant", label: "namkeen-noncompliant", declared: "200 g", measured: "197 g", mrp: "Rs 60/- · TAXES EXTRA", usp: "MISSING", ingredients: "Besan (52%), Refined Palmolein Oil (26%), Salt (2.8%), MSG (INS 621), Sodium Bicarbonate (INS 500(ii)), Caramel IV (INS 150d). Contains Soy.", score: 58, verdict: "NON_COMPLIANT", verdictText: "✗ NON-COMPLIANT", reason: "MRP syntax is illegal; USP is absent under Rule 6(11).", flags: [{ text: "SOY · CRITICAL", tone: "fail" }, { text: "HYPERTENSION · DANGER", tone: "fail" }, { text: "PALMOLEIN · DANGER", tone: "fail" }] },
  { id: "spices-expired", label: "spices-expired", declared: "100 g", measured: "89 g", mrp: "₹58.00", usp: "₹0.58/g", ingredients: "Coriander, Cumin, Mustard Seeds, Sodium Benzoate (INS 211).", score: 42, verdict: "NON_COMPLIANT", verdictText: "✗ NON-COMPLIANT", reason: "11 g shortfall breaches 4.5 g MPE; expiry is past.", flags: [{ text: "MUSTARD · MODERATE", tone: "review" }, { text: "MPE · FAIL", tone: "fail" }, { text: "EXPIRED", tone: "fail" }] },
];

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

function statusTone(status: string) {
  if (status.includes("PRESENT") || status.includes("N/A")) return "pass";
  if (status.includes("UNDERSIZED")) return "review";
  return "fail";
}

export default function Home() {
  const [activeId, setActiveId] = useState("namkeen-noncompliant");
  const [live, setLive] = useState<Dossier | null>(null);
  const [scanState, setScanState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [capturedFrames, setCapturedFrames] = useState<Array<{ label: string; data: string }>>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [manual, setManual] = useState({ product_name: "", declared_net_quantity: "200", scale_net_weight: "197", mrp: "60", expiry_date: "2027-02-14" });
  const activeFixture = fixtures.find(f => f.id === activeId) ?? fixtures[2];
  const liveDeclarations = live?.compliance.declarations ?? staticDeclarations;
  const liveRisks: RiskRecord[] = live?.health.chronicRisks ?? staticRisks;
  const liveAllergens = live?.health.allergens ?? [
    { id: "gluten", name: "Gluten", present: false, matchedKeywords: [], severity: "critical" },
    { id: "dairy", name: "Dairy", present: false, matchedKeywords: [], severity: "critical" },
    { id: "peanuts_tree_nuts", name: "Peanuts / tree nuts", present: false, matchedKeywords: [], severity: "critical" },
    { id: "soy", name: "Soy", present: true, matchedKeywords: ["soy"], severity: "critical" },
    { id: "eggs", name: "Eggs", present: false, matchedKeywords: [], severity: "critical" },
    { id: "fish_shellfish", name: "Fish / shellfish", present: false, matchedKeywords: [], severity: "critical" },
    { id: "sesame", name: "Sesame", present: false, matchedKeywords: [], severity: "moderate" },
    { id: "mustard", name: "Mustard", present: false, matchedKeywords: [], severity: "moderate" },
    { id: "sulfites", name: "Sulfites", present: true, matchedKeywords: ["INS 150d"], severity: "moderate" },
  ];
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
      setLive(await response.json() as Dossier);
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
      setLive(await response.json() as Dossier);
      setScanState("done");
    } catch {
      setScanState("error");
    }
  }

  const displayedQuantity = live ? `${live.compliance.quantity.declared} ${live.compliance.quantity.unit}` : activeFixture.declared;
  const displayedMeasured = live?.compliance.quantity.measured != null ? `${live.compliance.quantity.measured} g` : activeFixture.measured;
  const displayedMrp = live?.compliance.pricing.mrp != null ? `₹${live.compliance.pricing.mrp.toFixed(2)}` : activeFixture.mrp;
  const displayedUsp = live?.compliance.pricing.unitSalePrice != null ? `₹${live.compliance.pricing.unitSalePrice.toFixed(2)}${live.compliance.pricing.unitLabel.replace("₹", "")}` : activeFixture.usp;
  const riskMax = useMemo(() => Math.max(...liveRisks.map(r => r.score), 1), [liveRisks]);

  return (
    <div className="metrology-page">
      <div className="ruler ruler-left" aria-hidden="true" />
      <div className="ruler ruler-right" aria-hidden="true" />
      <header className="file-strip"><span>LEGAL METROLOGY ACT, 2009 · PCR 2011 (AMD. 2023) · FSSAI REG. 2.4.5</span><span>ENGINE REV. 0.8.4 · BUILD 2026.09</span></header>
      <main className="document-shell">
        <nav className="masthead" aria-label="Primary navigation">
          <a className="wordmark" href="#top" aria-label="MetrologyLens home">Metrology<span>Lens</span></a>
          <div className="nav-links"><a href="#pipeline">Pipeline</a><a href="#declarations">Declarations</a><a href="#verdicts">Verdicts</a><a href="#allergens">Health scan</a><a href="#api">API</a></div>
          <a className="nav-console" href="#console">Open console <span>↗</span></a>
        </nav>

        <section className="hero-section" id="top">
          <div className="hero-copy"><p className="section-kicker">A field instrument for printed truth</p><h1>Read the label.<br /><em>Measure the claim.</em></h1><p className="hero-lede">MetrologyLens turns a photographed package into a traceable inspection dossier: declarations, scale tolerance, pricing syntax, ingredients, allergens and health signals in one pass.</p><p className="citation">PCR 2011 · RULE 6(1) · SECOND SCHEDULE MPE · FSSAI 2.4.5</p><div className="hero-actions"><a className="button button-dark" href="#verdicts">See a sample dossier</a><a className="button button-line" href="#api">Read the API spec</a></div></div>
          <div className="scan-mock" aria-label="Sample inspection dossier">
            <div className="scan-topline"><span>FORM VI-A · INSPECTION DOSSIER</span><span>ML–00418</span></div>
            <div className="mock-workspace"><div className="pouch-label"><div className="pouch-edge" /><span className="pouch-brand">GRAINWORKS</span><strong>CLASSIC<br />BESAN SEV</strong><small>CRISP · SAVOURY · 200 g</small><div className="pouch-seal">QC<br /><b>26</b></div><div className="pouch-lines" /></div><div className="ocr-box box-product"><span>COMMODITY NAME</span><b>96%</b></div><div className="ocr-box box-qty"><span>NET QTY</span><b>93%</b></div><div className="ocr-box box-mrp"><span>MRP</span><b>88%</b></div><div className="ocr-box box-stamp"><span>EXPIRY</span><b>61%</b></div></div>
            <div className="scan-readout"><span><i className="status-dot" />3 frames · 14 fields extracted</span><strong>1 statutory violation found</strong></div>
          </div>
        </section>

        <section className="console-section ruled-section" id="console"><div className="section-head"><h2>Scan console</h2><span>MODULE 0 · LIVE INPUT</span></div><div className="console-grid"><div className="console-run"><div><p className="eyebrow">Automated CV pipeline</p><h3>Scan the real package with your camera</h3><p>Capture the front panel, ingredients panel, and barcode or batch side. The frames are posted together as one inspection dossier.</p></div><div className="console-controls"><select aria-label="Fixture fallback" value={activeId} onChange={event => setActiveId(event.target.value)}>{fixtures.map(f => <option key={f.id} value={f.id}>{f.label} fallback</option>)}</select><button className="button button-dark" onClick={openCamera} disabled={scanState === "loading"}>{scanState === "loading" ? "Scanning…" : "Open camera"}</button><span className={`console-status ${scanState}`}>{scanState === "done" ? "API RESPONSE RECEIVED" : scanState === "error" ? "API UNAVAILABLE" : "CAMERA READY"}</span></div></div><form className="manual-form" onSubmit={runManualAudit}><div><p className="eyebrow">Manual fallback</p><h3>Torn or obscured label</h3></div><input aria-label="Product name" placeholder="Product name" value={manual.product_name} onChange={e => setManual({ ...manual, product_name: e.target.value })} /><input aria-label="Declared quantity" placeholder="Declared g" value={manual.declared_net_quantity} onChange={e => setManual({ ...manual, declared_net_quantity: e.target.value })} /><input aria-label="Measured quantity" placeholder="Measured g" value={manual.scale_net_weight} onChange={e => setManual({ ...manual, scale_net_weight: e.target.value })} /><input aria-label="MRP" placeholder="MRP ₹" value={manual.mrp} onChange={e => setManual({ ...manual, mrp: e.target.value })} /><button className="button button-line" type="submit" disabled={scanState === "loading"}>Audit manual fields</button></form></div>{cameraOpen && <div className="camera-panel" role="dialog" aria-modal="true" aria-labelledby="camera-title"><div className="camera-view"><video ref={videoRef} autoPlay playsInline muted aria-label="Live package camera preview" /><div className="camera-frame" aria-hidden="true" /><span className="camera-guide">Align {capturedFrames.length === 0 ? "front PDP" : capturedFrames.length === 1 ? "ingredients panel" : "barcode / batch side"} inside the frame</span></div><div className="camera-side"><div><p className="eyebrow">Camera capture · {capturedFrames.length}/3 panels</p><h3 id="camera-title">Build the inspection dossier</h3><p>Use even light. Keep text flat and fill the guide with one package panel at a time.</p></div><div className="capture-list">{["Front PDP", "Ingredients panel", "Barcode / batch side"].map((label, index) => <div className={`capture-item ${capturedFrames[index] ? "captured" : ""}`} key={label}><span>{capturedFrames[index] ? "✓" : String(index + 1).padStart(2, "0")}</span><strong>{label}</strong>{capturedFrames[index] && <small>frame ready</small>}</div>)}</div>{cameraError && <p className="camera-error" role="alert">{cameraError}</p>}<div className="camera-actions"><button className="button button-line" onClick={closeCamera}>Close camera</button><button className="button button-line" onClick={captureFrame} disabled={capturedFrames.length >= 3}>Capture panel</button><button className="button button-dark" onClick={() => runLiveScan()} disabled={capturedFrames.length === 0 || scanState === "loading"}>{scanState === "loading" ? "Sending…" : "Scan captured frames"}</button></div></div></div>}</section>

        <section className="ruled-section" id="pipeline"><div className="section-head"><h2>Image pipeline</h2><span>MODULE 1–2 · CV + OCR</span></div><div className="pipeline-grid">{[["01", "Grayscale", "ITU-R BT.601 luminance isolates ink from stock."], ["02", "Denoise", "5×5 Gaussian filter cuts print grain."], ["03", "CLAHE", "8×8 contrast tiles recover faint stamps."], ["04", "Binarize", "Adaptive Gaussian unioned with Otsu."], ["05", "Deskew", "Tilt is corrected inside a ±25° window."], ["06", "Upscale", "1.75× cubic interpolation clears the OCR floor."]].map(([n, title, detail]) => <div className="pipeline-step" key={n}><span className="step-num">{n}</span><h3>{title}</h3><p>{detail}</p></div>)}</div></section>

        <section className="ruled-section" id="declarations"><div className="section-head"><h2>Declarations ledger</h2><span>RULE 6(1) · WORKED EXAMPLE / {currentProductName.toUpperCase()}</span></div><div className="ledger">{liveDeclarations.map(row => <div className="ledger-row" key={row.rule}><span className="rule-id">{row.rule}</span><div className="ledger-name"><strong>{row.name}</strong><span>{row.explanation}</span></div><code>{row.found}</code><span className={`ledger-status ${statusTone(row.status)}`}>{row.status}</span></div>)}</div></section>

        <section className="ruled-section" id="verdicts"><div className="section-head"><h2>Verdicts</h2><span>GROUND-TRUTH FIXTURES · 4 CASES</span></div><div className="fixture-tabs" role="tablist" aria-label="Ground-truth fixtures">{fixtures.map(f => <button key={f.id} role="tab" aria-selected={activeId === f.id} className={activeId === f.id ? "active" : ""} onClick={() => { setActiveId(f.id); setLive(null); }}>{f.label}</button>)}</div><div className="verdict-panel"><div className="fixture-data"><dl><div><dt>Declared / measured</dt><dd>{live && activeId === "namkeen-noncompliant" ? displayedQuantity : activeFixture.declared} <span>/</span> {live && activeId === "namkeen-noncompliant" ? displayedMeasured : activeFixture.measured}</dd></div><div><dt>MRP / unit sale price</dt><dd>{live && activeId === "namkeen-noncompliant" ? displayedMrp : activeFixture.mrp} <span>/</span> {live && activeId === "namkeen-noncompliant" ? displayedUsp : activeFixture.usp}</dd></div><div><dt>Ingredient read</dt><dd className="ingredient-read">{activeFixture.ingredients}</dd></div><div><dt>Match score</dt><dd className="score-read">{live && activeId === "namkeen-noncompliant" ? live.compliance.matchScore : activeFixture.score}<span>/100</span></dd></div></dl><div className="flag-row">{activeFixture.flags.map(flag => <span key={flag.text} className={`flag-chip ${flag.tone}`}>{flag.text}</span>)}</div></div><div className={`ink-stamp ${activeVerdict.verdict === "COMPLIANT" ? "pass" : activeVerdict.verdict === "NEEDS_REVIEW" ? "review" : "fail"}`}><span>{activeVerdict.text}</span><small>{activeVerdict.reason}</small></div></div></section>

        <section className="ruled-section" id="allergens"><div className="section-head"><h2>Allergen & health risk</h2><span>FSSAI REG. 2.4.5 · WORKED EXAMPLE</span></div><div className="allergen-grid">{liveAllergens.map(allergen => <div className={`allergen-cell ${allergen.present ? "present" : "clear"}`} key={allergen.id}><div><strong>{allergen.name}</strong><span>{allergen.present ? allergen.severity.toUpperCase() : "NOT FOUND"}</span></div><p>{allergen.present ? `Matched ${allergen.matchedKeywords.join(", ")}.` : "No keyword match in the ingredient read."}</p></div>)}</div><p className="statutory-line">{live?.health.statutoryLine ?? "ALLERGEN DECLARATION (FSSAI Reg. 2.4.5): Contains Soy, Sulfites. Sensitive consumers must exercise strict caution."}</p><div className="risk-strip">{liveRisks.slice(0, 4).map(risk => <div className="risk-item" key={risk.id ?? risk.name}><div className="risk-label"><strong>{risk.name}</strong><span className={`risk-level ${risk.level ?? risk.tone ?? "low"}`}>{(risk.level ?? risk.tone ?? "low").toUpperCase()}</span></div><div className="risk-bar"><i className={risk.level ?? risk.tone ?? "low"} style={{ width: `${Math.round((risk.score / riskMax) * 100)}%` }} /></div><p>{risk.reason}</p></div>)}</div></section>

        <section className="ruled-section" id="api"><div className="section-head"><h2>API surface</h2><span>REST · JSON · /API</span></div><div className="api-table"><div className="api-row api-head"><span>METHOD</span><span>PATH</span><span>RETURNS</span></div>{[["POST", "/api/scan", "Full OCR dossier, Rule 6 results, MPE, barcode, allergens and health advisories."], ["POST", "/api/manual-audit", "Identical compliance and health evaluation from fallback fields."], ["GET", "/api/batches", "Batch manifest summaries and pass rates."], ["POST", "/api/batches", "Creates a planned inspection batch."], ["POST", "/api/discrepancies", "Section 36 discrepancy ticket."], ["GET", "/api/export/csv?batch_id=", "CSV manifest attachment."], ["GET", "/api/export/json?batch_id=", "JSON dossier + Form IV object."]].map(([method, path, returns]) => <div className="api-row" key={`${method}-${path}`}><span className={`method ${method.toLowerCase()}`}>{method}</span><code>{path}</code><span>{returns}</span></div>)}</div></section>
      </main>
      <footer className="site-footer"><span>Preview engine · not a substitute for statutory officer sign-off.</span><span>LEGAL METROLOGY ACT, 2009 · PCR 2011 · FSSAI REG. 2.4.5</span></footer>
    </div>
  );
}
