export type OcrBox = {
  text: string;
  confidence: number;
  isLowConfidence: boolean;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  top: number;
  left: number;
  width: number;
  height: number;
};

export type OcrDossier = {
  text: string;
  boxes: OcrBox[];
  config: { psm: 6 | 11; whitelist?: string };
  panels: string[];
};

export function normalizeBox(text: string, confidence: number, bounds: [number, number, number, number]): OcrBox {
  const [x0, y0, x1, y1] = bounds;
  return {
    text,
    confidence,
    isLowConfidence: confidence < 60,
    x0,
    y0,
    x1,
    y1,
    top: y0,
    left: x0,
    width: x1 - x0,
    height: y1 - y0,
  };
}

/** Deterministic text adapter used by manual audits and fixture previews. */
export function aggregateOcr(
  panels: Array<{ label: string; text: string; boxes?: OcrBox[] }>,
  options: { psm?: 6 | 11; whitelist?: string } = {},
): OcrDossier {
  return {
    text: panels.map((panel, index) => `[PANEL ${index + 1} - ${panel.label}]\n${panel.text}`).join("\n\n"),
    boxes: panels.flatMap(panel => panel.boxes ?? []),
    config: { psm: options.psm ?? 11, whitelist: options.whitelist },
    panels: panels.map(panel => panel.label),
  };
}
