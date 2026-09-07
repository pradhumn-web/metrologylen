export type ChipsCompanyMasterRow = {
  brandId: string;
  brand: string;
  product: string;
  manufacturer: string;
  origin: string;
  netQuantity: string;
  mfgDate: string;
  bestBefore: string;
  mrp: string;
  unitSalePrice: string;
  consumerCare: string;
  barcode: string;
};

export type ChipsMetrologyRow = { brandId: string; ruleCode: string; ruleName: string; expected: string; required: boolean };

export const chipsCompanyMasterDataset: ChipsCompanyMasterRow[] = [
  { brandId: "chips-lays", brand: "Lay's", product: "Lay's Classic Salted Chips", manufacturer: "Demo Foods India Pvt Ltd, Gurugram 122001", origin: "India", netQuantity: "52 g", mfgDate: "06/2026", bestBefore: "6 months", mrp: "₹20.00", unitSalePrice: "₹0.38/g", consumerCare: "18001234567 · care@demofoods.in", barcode: "8901000000001" },
  { brandId: "chips-bingo", brand: "Bingo!", product: "Bingo! Salted Chips", manufacturer: "Demo Snacks India Ltd, Bengaluru 560001", origin: "India", netQuantity: "90 g", mfgDate: "06/2026", bestBefore: "6 months", mrp: "₹50.00", unitSalePrice: "₹0.56/g", consumerCare: "18001234568 · care@demosnacks.in", barcode: "8901000000002" },
  { brandId: "chips-balaji", brand: "Balaji", product: "Balaji Salted Wafers", manufacturer: "Demo Wafers Pvt Ltd, Rajkot 360001", origin: "India", netQuantity: "55 g", mfgDate: "06/2026", bestBefore: "6 months", mrp: "₹20.00", unitSalePrice: "₹0.36/g", consumerCare: "18001234569 · care@demowafers.in", barcode: "8901000000003" },
  { brandId: "chips-tooyumm", brand: "Too Yumm!", product: "Too Yumm! Potato Chips", manufacturer: "Demo Better Snacks Ltd, Gurugram 122018", origin: "India", netQuantity: "70 g", mfgDate: "06/2026", bestBefore: "6 months", mrp: "₹35.00", unitSalePrice: "₹0.50/g", consumerCare: "18001234570 · care@demobetter.in", barcode: "8901000000004" },
  { brandId: "chips-unclechipps", brand: "Uncle Chipps", product: "Uncle Chipps Plain Salted", manufacturer: "Demo Foods India Pvt Ltd, New Delhi 110001", origin: "India", netQuantity: "55 g", mfgDate: "06/2026", bestBefore: "6 months", mrp: "₹20.00", unitSalePrice: "₹0.36/g", consumerCare: "18001234571 · care@demochipps.in", barcode: "8901000000005" },
];

export const chipsMetrologyDataset: ChipsMetrologyRow[] = chipsCompanyMasterDataset.flatMap(row => [
  ["R1", "Manufacturer / packer / importer", row.manufacturer], ["R2", "Country of origin", row.origin], ["R3", "Generic commodity name", row.product], ["R4", "Net quantity", row.netQuantity], ["R5", "Manufacture / pack date", row.mfgDate], ["R6", "Best-before / expiry", row.bestBefore], ["R7", "Maximum retail price", row.mrp], ["R8", "Unit sale price", row.unitSalePrice], ["R9", "Consumer care", row.consumerCare], ["R10", "Barcode / traceability", row.barcode],
].map(([ruleCode, ruleName, expected]) => ({ brandId: row.brandId, ruleCode, ruleName, expected, required: true })));
