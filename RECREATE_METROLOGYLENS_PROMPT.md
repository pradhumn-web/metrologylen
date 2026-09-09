# Prompt: Recreate the MetrologyLens Website Exactly

You are an expert full-stack product engineer and UI designer. Recreate the **MetrologyLens — Commodity Compliance** web application exactly as specified below. Do not simplify the product into a generic dashboard. Preserve the document-like statutory-inspection visual language, scan-first workflow, mobile app behavior, seeded chips catalog, 10-rule checklist, ingredient table, allergen analysis, and health-risk results.

## Product purpose

Build a camera-led package commodity inspection application for Indian legal-metrology review. The primary user is an inspector who photographs a package and verifies ten metrology rules. The application must make **Start package scan** the dominant action.

The application is a demonstration system. Clearly label seeded company information as **demo reference data** and do not represent it as verified manufacturer data or an enforcement decision.

## Required visual direction

Use a warm statutory-document palette rather than a generic SaaS dashboard:

- Background: pale warm paper, approximately `#ebe8dc`.
- Foreground ink: deep charcoal, approximately `#1a1d16`.
- Secondary ink: muted grey-green.
- Accent: inspection indigo/navy, approximately `#2b3a5c`.
- Pass: muted green.
- Review: ochre or amber.
- Fail: muted red.
- Use subtle horizontal paper rules, thin dark borders, document rails, ruled sections, and restrained shadows.
- Use a serif display face for the large hero headline and a compact sans/monospace style for labels, codes, evidence, and statutory metadata.
- Use a document-width desktop layout with side rails and an asymmetric hero: large headline on the left and an inspection dossier/package mockup on the right.
- Avoid gradients, neon colors, excessive rounded cards, or generic centered dashboard layouts.
- Keep motion restrained, fast, and accessible. Respect `prefers-reduced-motion`.

## Page structure

Create a single responsive application page with these sections:

1. **Statutory top strip** with Legal Metrology Act, PCR, FSSAI, engine revision, and build metadata.
2. **Masthead** with MetrologyLens wordmark, desktop links for Declarations, Verdicts, and Health scan, plus an Open console action.
3. **Hero** with the exact conceptual headline:
   - `Read the label.`
   - `Measure the claim.`
   Include a short explanation that package scans extract quantity, MRP, dates, consumer care, barcode, ingredients, allergens, and health signals. Show `PRIMARY WORKFLOW · 4 PANEL CAPTURE · 10 METROLOGY RULES` and buttons for `Start package scan ↗` and `View 10 rules`.
4. **Package scan console** as the primary workflow.
5. **10-rule metrology checklist** with editable checkboxes and company values.
6. **Declarations ledger** showing statutory declaration evidence and status.
7. **Verdicts** with five product tabs, measured/declared quantity, MRP, unit sale price, ingredient table, score, flags, and verdict stamp.
8. **Allergen & health risk** panel with allergen matrix, statutory allergen line, and risk bars.
9. **Footer** with statutory references and demo-data disclaimer.
10. On mobile, use a fixed safe-area bottom navigation with exactly four equal actions: `Scan`, `Rules`, `Verdicts`, and `Health`.

## Camera scan workflow

The hero and console must open the browser camera using `navigator.mediaDevices.getUserMedia` with a rear-facing preference where available.

Capture exactly four panels in this order:

1. `Front PDP` — product name, commodity name, quantity, and MRP.
2. `Back PDP` — manufacturer, origin, dates, consumer care, and additional declarations.
3. `Ingredients panel` — ingredients, additives, allergens, and health signals.
4. `Barcode / batch side` — barcode, batch, lot, and traceability evidence.

Show a camera dialog with a live video preview, a framing guide, a panel counter, a capture list, and actions for Close camera, Capture panel, and Run 10-rule scan. The guide text must change for each panel. Limit capture to four frames.

The package scan console must show a progress strip with `0/4 panels captured`, current guidance, a progress bar, and a Start package scan or Continue capture button. After capture, submit all image data as one inspection dossier to `/api/scan`.

## Ten metrology rules

The checklist must contain editable checkboxes for:

| Code | Rule | Expected value |
|---|---|---|
| R1 | Manufacturer / packer / importer | Name and complete postal address |
| R2 | Country of origin | Required country declaration |
| R3 | Generic commodity name | Clear principal display panel name |
| R4 | Net quantity | Metric quantity and correct unit |
| R5 | Manufacture / pack date | Month and year declaration |
| R6 | Best-before / expiry | Readable date or shelf-life statement |
| R7 | Maximum retail price | MRP inclusive of all taxes |
| R8 | Unit sale price | Derived price per standard unit |
| R9 | Consumer care | Phone, email, and postal contact |
| R10 | Barcode / traceability | Barcode, batch, or lot reference |

Each checkbox row must show:

- Rule code and title.
- Explanation of what the rule checks.
- The selected brand’s expected demo company value.
- Checked or unchecked state.
- A clear source label: `Company demo reference value` before a live scan, or `Observed OCR evidence` after a live scan.

Show a `checked/10` summary, progress bar, Reset checklist button, and Download report button. Keep values readable on mobile and allow long values to wrap.

## Five seeded chips brands

Replace any unrelated product fixtures with exactly these five demo products:

1. **Lay's chips**
   - Product: Lay's Classic Salted Chips
   - Net quantity: 52 g
   - MRP: ₹20.00
   - Unit sale price: ₹0.38/g
   - Ingredients: Potatoes, Edible Vegetable Oil (Palmolein), Iodised Salt.
   - Verdict: COMPLIANT
   - Distinct risks: salt/sodium and palmolein.

2. **Bingo! chips**
   - Product: Bingo! Salted Chips
   - Net quantity: 90 g
   - MRP: ₹50.00
   - Unit sale price: ₹0.56/g
   - Ingredients: Potatoes, Edible Vegetable Oil, Iodised Salt, Spices, Acidity Regulator (INS 330).
   - Verdict: COMPLIANT
   - Distinct risks: salt/sodium and additive sensitivity.

3. **Balaji wafers**
   - Product: Balaji Salted Wafers
   - Net quantity: 55 g
   - MRP: ₹20.00
   - Unit sale price: ₹0.36/g
   - Ingredients: Potatoes, Palmolein Oil, Salt, Sugar, Spices. Contains Milk Solids.
   - Verdict: NEEDS_REVIEW
   - Distinct allergens/risks: dairy, salt, palmolein, and sugar.

4. **Too Yumm! chips**
   - Product: Too Yumm! Potato Chips
   - Net quantity: 70 g
   - MRP: ₹35.00
   - Unit sale price: ₹0.50/g
   - Ingredients: Potatoes, Rice Bran Oil, Salt, Chilli, Acidity Regulator (INS 330).
   - Verdict: COMPLIANT
   - Distinct risks: salt/sodium and additive sensitivity.

5. **Uncle Chipps**
   - Product: Uncle Chipps Plain Salted
   - Net quantity: 55 g
   - MRP: ₹20.00
   - Unit sale price: ₹0.36/g
   - Ingredients: Potatoes, Edible Vegetable Oil, Salt, Sugar, Spices. Contains Soy.
   - Verdict: NEEDS_REVIEW
   - Distinct allergens/risks: soy, salt/sodium, sugar, and vegetable oil.

Provide distinct allergens, risk scores, risk explanations, flags, statutory allergen lines, and metrology states for each product. Switching tabs must update every related panel.

## Company datasets

Create two separate datasets:

1. **Company master dataset** containing one row per chips brand with brand ID, brand name, product, manufacturer/address, country, quantity, manufacture date, best-before period, MRP, unit sale price, consumer care, and barcode.
2. **Company metrology dataset** containing one row per brand per rule, with brand ID, rule code, rule name, expected value, and required status.

Expose a read-only endpoint such as `GET /api/chips/catalog` returning both datasets and a disclaimer that the values are seeded demo reference data.

Manual typed brand matching must recognize aliases such as `lays`, `lay's`, `bingo`, `balaji`, `wafers`, `too yumm`, `tooyumm`, `uncle chipps`, and `uncle chips`.

If a scanned product is not one of the five seeded brands, do not falsely assign it to a known company profile. Show a generic inspection result and an unmatched/company-data status.

## Backend behavior

Use a Node.js + Express server with typed TypeScript modules. Provide endpoints for:

- `POST /api/scan` — accepts captured image frames and returns a dossier.
- `POST /api/manual-audit` — evaluates manually entered values.
- `GET /api/chips/catalog` — returns company master and ten-rule datasets.
- Batch, discrepancy, and report export endpoints as needed.

Implement modular logic for:

- Image capture metadata and pipeline contracts.
- OCR result aggregation with confidence evidence.
- Quantity tolerance and MPE evaluation.
- MRP and unit sale price validation.
- Dates and expiry.
- Declaration presence.
- Barcode/batch traceability.
- Ingredient parsing and additive detection.
- Allergen matrix.
- Health-risk advisories.

## Data and safety requirements

- Label seeded values as demo reference data.
- Do not claim that demo manufacturer names or barcodes are official.
- Clearly separate OCR-observed evidence from company reference values.
- Present the verdict as an inspection aid that requires statutory officer sign-off before enforcement.
- Preserve accessibility: keyboard support, visible focus, semantic labels, readable contrast, and reduced-motion support.

## Suggested implementation structure

Use this structure or an equivalent one:

```text
client/
  index.html
  public/manifest.json
  public/sw.js
  src/
    App.tsx
    index.css
    main.tsx
    pages/Home.tsx
server/
  compliance/app.ts
  compliance/chips_datasets.ts
  compliance/compliance_rules.ts
  compliance/health_engine.ts
  compliance/image_pipeline.ts
  compliance/ocr_engine.ts
  compliance/fixtures.ts
  routers.ts
  db.ts
drizzle/
  schema.ts
shared/
  types.ts
```

## Validation requirements

Before delivery:

1. Run TypeScript checking.
2. Run automated tests for authentication and compliance fixtures.
3. Run the production build.
4. Verify the four-panel capture sequence and 0/4 progress state.
5. Verify each of the five product tabs updates verdicts, ingredients, allergens, health risks, and checklist values.
6. Verify long company values wrap correctly on mobile.
7. Verify the mobile bottom navigation has exactly four equal items.
8. Verify unmatched products are not falsely mapped to a seeded brand.
9. Verify the report download includes the current checklist values.

The final result should feel like a precise mobile-ready statutory inspection instrument, not a generic food product dashboard.

## Routed application update

The application is page-based rather than one long scrolling document. Use these routes:

| Route | Purpose |
|---|---|
| `/` | Home page with scan-first hero and three mode entry points. |
| `/scan` | Four-panel camera scanner and scan progress. |
| `/rules` | Dedicated editable ten-rule checklist with expected company values. |
| `/verdicts` | Dedicated product verdict, evidence, ingredient summary, and score page. |
| `/health` | Dedicated allergen, ingredient, additive, and health-risk page. |
| `/history` | Local device scan history with timestamp, brand, panel count, verdict, and score. |
| `/modes` | Tri-mode workspace selector. Supports Consumer / Officer, Company, and Admin modes. |
| `/assistant` | Chatbot guide for using the application. |

Use a shared responsive application shell with a desktop sidebar and a mobile bottom navigation. The mobile navigation should expose Home, Scan, Rules, Verdicts, Health, and History. Add an always-visible `Need help? Ask the guide` entry in the header.

## Tri-mode workspace

The Home page must expose three modes:

- **Consumer / Officer:** Open scanner, rules, verdicts, health, and scan history.
- **Company:** Select a product and show the number and names of metrology rules that the product fails. Include explanations and a disclaimer that verified company data and statutory review are required.
- **Admin:** Select a product, choose a catalog field such as MRP, best-before, consumer care, or manufacturer, enter a replacement value, and save it through an authenticated catalog-amendment API to a persistent database table. Show a success message and preserve an amendment audit trail in production.

## Chatbot guide

Add a chatbot page using a server-side LLM proxy. The assistant should explain camera permission, the four capture panels, the ten rules, verdict meaning, health-risk interpretation, scan history, company mode, and admin mode. It must not present demo values as official legal advice. Include suggested prompts and a fallback response when the LLM service is unavailable. Never expose LLM credentials in browser code.
