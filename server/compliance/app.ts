import type { Express, Request, Response } from "express";
import { randomUUID } from "crypto";
import { evaluateCompliance } from "./compliance_rules";
import { evaluateHealth } from "./health_engine";
import { getFixture, fixtures, toDossier } from "./fixtures";

export type BatchItem = { sku: string; scannedAt: number; verdict: string; matchScore: number; discrepancy: boolean };
export type Batch = { id: string; code: string; name: string; plannedQuantity: number; scannedCount: number; passCount: number; discrepancyCount: number; passRate: number; items: BatchItem[] };
export type DiscrepancyTicket = { ticketId: string; timestamp: number; batchId: string; sku: string; violationCategory: string; severity: string; inspectorId: string; ruleRef: string; details: string };

const batches = new Map<string, Batch>();
const tickets: DiscrepancyTicket[] = [];

function createBatch(code: string, name: string, targetCount: number): Batch {
  const batch: Batch = { id: `B-${randomUUID().slice(0, 8).toUpperCase()}`, code, name, plannedQuantity: targetCount, scannedCount: 0, passCount: 0, discrepancyCount: 0, passRate: 0, items: [] };
  batches.set(batch.id, batch);
  return batch;
}

const defaultBatch = createBatch("APR-26-001", "West region intake", 24);

function updateBatch(batchId: string | undefined, sku: string, verdict: string, matchScore: number) {
  const batch = (batchId && batches.get(batchId)) || defaultBatch;
  const discrepancy = verdict !== "COMPLIANT";
  batch.items.push({ sku, scannedAt: Date.now(), verdict, matchScore, discrepancy });
  batch.scannedCount += 1;
  batch.passCount += discrepancy ? 0 : 1;
  batch.discrepancyCount += discrepancy ? 1 : 0;
  batch.passRate = Math.round((batch.passCount / batch.scannedCount) * 100);
  return batch;
}

function makeFormIV(batch: Batch) {
  return {
    certificateType: "FORM IV statutory inspection certificate",
    certificateNumber: `ML-${batch.id}`,
    statute: "Legal Metrology Act, 2009 / PCR 2011 (amended 2023)",
    batch: { id: batch.id, code: batch.code, name: batch.name },
    inspectionSummary: { plannedQuantity: batch.plannedQuantity, scannedCount: batch.scannedCount, passCount: batch.passCount, discrepancyCount: batch.discrepancyCount, passRate: batch.passRate },
    issuedAt: new Date().toISOString(),
    inspectorDeclaration: "The above observations are generated from the recorded inspection dossier and require statutory officer sign-off before enforcement.",
  };
}

function manualDossier(body: Record<string, unknown>) {
  const compliance = evaluateCompliance({
    productName: String(body.product_name ?? "Manual audit item"),
    commodityCategory: String(body.commodity_category ?? "unclassified"),
    declaredNetQuantity: Number(body.declared_net_quantity ?? 0),
    quantityUnit: String(body.quantity_unit ?? "g"),
    scaleNetWeight: body.scale_net_weight == null ? undefined : Number(body.scale_net_weight),
    mrp: body.mrp == null ? undefined : Number(body.mrp),
    mrpText: body.mrp_text == null ? undefined : String(body.mrp_text),
    catalogPrice: body.catalog_price == null ? undefined : Number(body.catalog_price),
    mfgDate: body.mfg_date == null ? undefined : String(body.mfg_date),
    expiryDate: body.expiry_date == null ? undefined : String(body.expiry_date),
    manufacturerAddress: body.manufacturer_address == null ? undefined : String(body.manufacturer_address),
    consumerCare: body.consumer_care == null ? undefined : String(body.consumer_care),
    countryOfOrigin: body.country_of_origin == null ? undefined : String(body.country_of_origin),
    ingredients: body.ingredients == null ? "" : String(body.ingredients),
  });
  const health = evaluateHealth(String(body.ingredients ?? ""), String(body.allergen_text ?? ""));
  return { fixtureId: "manual-audit", productName: body.product_name, compliance, health, ocr: null, pipeline: [], statutoryReferences: ["Legal Metrology Act, 2009", "PCR 2011 (amended 2023)", "FSSAI Reg. 2.4.5"] };
}

export function registerComplianceRoutes(app: Express) {
  app.post("/api/scan", (req: Request, res: Response) => {
    const requested = typeof req.body?.preset_fallback === "string" ? req.body.preset_fallback : "namkeen-noncompliant";
    const selected = getFixture(requested) ?? fixtures["namkeen-noncompliant"];
    const batch = updateBatch(req.body?.batch_id, selected.id, selected.compliance.verdict, selected.compliance.matchScore);
    res.json({ ...toDossier(selected), batch });
  });

  app.post("/api/manual-audit", (req: Request, res: Response) => {
    const dossier = manualDossier(req.body ?? {});
    const batch = updateBatch(typeof req.body?.batch_id === "string" ? req.body.batch_id : undefined, String(req.body?.product_name ?? "manual-audit"), dossier.compliance.verdict, dossier.compliance.matchScore);
    res.json({ ...dossier, batch });
  });

  app.get("/api/batches", (_req: Request, res: Response) => res.json(Array.from(batches.values()).map(({ items, ...summary }) => summary)));
  app.post("/api/batches", (req: Request, res: Response) => res.status(201).json(createBatch(String(req.body?.code ?? "NEW-BATCH"), String(req.body?.name ?? "Unnamed batch"), Number(req.body?.target_count ?? 0))));
  app.post("/api/discrepancies", (req: Request, res: Response) => {
    const ticket: DiscrepancyTicket = { ticketId: `T-${randomUUID().slice(0, 8).toUpperCase()}`, timestamp: Date.now(), batchId: String(req.body?.batch_no ?? defaultBatch.id), sku: String(req.body?.sku_id ?? "unknown"), violationCategory: String(req.body?.violation_category ?? "unclassified"), severity: String(req.body?.severity ?? "review"), inspectorId: String(req.body?.inspector_id ?? "inspector-local"), ruleRef: String(req.body?.rule_ref ?? "Section 36"), details: String(req.body?.memo ?? "") };
    tickets.push(ticket);
    res.status(201).json(ticket);
  });
  app.get("/api/export/csv", (req: Request, res: Response) => {
    const batch = batches.get(String(req.query.batch_id ?? defaultBatch.id)) ?? defaultBatch;
    const lines = ["batch_id,sku,scanned_at,verdict,match_score,discrepancy", ...batch.items.map(item => [batch.id, item.sku, new Date(item.scannedAt).toISOString(), item.verdict, item.matchScore, item.discrepancy].map(value => `"${String(value).replace(/"/g, '""')}"`).join(","))];
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${batch.id}-manifest.csv"`);
    res.send(lines.join("\n"));
  });
  app.get("/api/export/json", (req: Request, res: Response) => {
    const batch = batches.get(String(req.query.batch_id ?? defaultBatch.id)) ?? defaultBatch;
    res.setHeader("Content-Disposition", `attachment; filename="${batch.id}-dossier.json"`);
    res.json({ batch, tickets: tickets.filter(ticket => ticket.batchId === batch.id), formIV: makeFormIV(batch) });
  });
}
