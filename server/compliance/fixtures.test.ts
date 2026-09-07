import { describe, expect, it } from "vitest";
import { fixtures } from "./fixtures";
import { allowableShortfall, evaluateCompliance } from "./compliance_rules";
import { evaluateHealth } from "./health_engine";

describe("Second Schedule math", () => {
  it("returns the prescribed MPE thresholds", () => {
    expect(allowableShortfall(500)).toBe(15);
    expect(allowableShortfall(5000)).toBe(75);
    expect(allowableShortfall(100)).toBe(4.5);
    expect(allowableShortfall(200)).toBe(9);
  });
});

describe("MetrologyLens ground-truth fixtures", () => {
  it("passes oats at 502g against a 500g declaration", () => {
    const fixture = fixtures["oats-500g"];
    expect(fixture.compliance.matchScore).toBe(100);
    expect(fixture.compliance.verdictLabel).toBe("✓ Compliant");
    expect(fixture.compliance.quantity.tolerance).toBe("PASS");
    expect(fixture.health.allergens.find(a => a.id === "gluten")?.present).toBe(true);
    expect(fixture.health.chronicRisks.find(r => r.id === "celiac")?.level).toBe("danger");
    expect(fixture.health.chronicRisks.find(r => r.id === "hypertension_cvd")?.level).toBe("low");
  });

  it("passes 5kg rice at 5018g and detects no allergens", () => {
    const fixture = fixtures["rice-5kg"];
    expect(fixture.compliance.verdictLabel).toBe("✓ Compliant");
    expect(fixture.compliance.quantity.tolerance).toBe("PASS");
    expect(fixture.compliance.quantity.allowableShortfall).toBe(75);
    expect(fixture.health.allergens.filter(a => a.present)).toHaveLength(0);
  });

  it("rejects namkeen MRP and missing USP while surfacing health risk", () => {
    const fixture = fixtures["namkeen-noncompliant"];
    expect(fixture.compliance.matchScore).toBeLessThanOrEqual(60);
    expect(fixture.compliance.verdictLabel).toBe("✗ Non-Compliant");
    expect(fixture.compliance.pricing.mrpSyntax).toBe("ILLEGAL");
    expect(fixture.health.allergens.filter(a => a.present).map(a => a.id)).toEqual(["soy", "sulfites"]);
    expect(fixture.health.chronicRisks.find(r => r.id === "hypertension_cvd")?.level).toBe("danger");
    expect(fixture.health.chronicRisks.find(r => r.id === "atherosclerosis")?.level).toBe("danger");
  });

  it("flags spices for MPE breach and expired stock", () => {
    const fixture = fixtures["spices-expired"];
    expect(fixture.compliance.matchScore).toBeLessThanOrEqual(50);
    expect(fixture.compliance.verdictLabel).toBe("✗ Non-Compliant");
    expect(fixture.compliance.quantity.tolerance).toBe("FAIL");
    expect(fixture.compliance.expiry.risk).toBe("CRITICAL_EXPIRED");
    expect(fixture.health.allergens.find(a => a.id === "mustard")?.present).toBe(true);
  });

  it("adds compliant Lay’s chips with salt and palmolein advisories", () => {
    const fixture = fixtures["lays-chips"];
    expect(fixture.compliance.verdictLabel).toBe("✓ Compliant");
    expect(fixture.compliance.quantity.tolerance).toBe("PASS");
    expect(fixture.health.allergens.filter(a => a.present)).toHaveLength(0);
    expect(fixture.health.chronicRisks.find(r => r.id === "atherosclerosis")?.level).toBe("danger");
  });

  it("adds Parle-G with gluten and dairy signals", () => {
    const fixture = fixtures["parle-g-biscuit"];
    expect(fixture.compliance.verdictLabel).toBe("✓ Compliant");
    expect(fixture.health.allergens.find(a => a.id === "gluten")?.present).toBe(true);
    expect(fixture.health.allergens.find(a => a.id === "dairy")?.present).toBe(true);
  });

  it("adds Fizz with a sugar advisory and valid quantity tolerance", () => {
    const fixture = fixtures["fizz-softdrink"];
    expect(fixture.compliance.verdictLabel).toBe("✓ Compliant");
    expect(fixture.compliance.quantity.tolerance).toBe("PASS");
    expect(fixture.health.chronicRisks.find(r => r.id === "diabetes")?.level).toBe("warning");
  });
});

describe("manual audit contract", () => {
  it("evaluates the same engine without OCR", () => {
    const result = evaluateCompliance({ productName: "Manual item", declaredNetQuantity: 100, quantityUnit: "g", scaleNetWeight: 101, mrp: 12, mrpText: "MRP ₹12 inclusive of all taxes", manufacturerAddress: "Unit, Delhi 110001", countryOfOrigin: "India", mfgDate: "06/2026", expiryDate: "2027-06-30", consumerCare: "care@unit.in 18001234567" });
    expect(result.quantity.tolerance).toBe("PASS");
    expect(result.pricing.mrpSyntax).toBe("VALID");
    expect(evaluateHealth("Ingredients: Rice, Mustard Seeds.").allergens.find(a => a.id === "mustard")?.present).toBe(true);
  });
});
