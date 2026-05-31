import { OcrLine } from '../../invoice-ocr/clients/ocr-worker.client';
import { normalizeText, normalizeAmount } from '../normalizers/normalize-text';

export interface ExtractedLineItem {
  rawName: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  lineTotal?: number;
  confidence: number;
  needsReview: boolean;
}

const Y_THRESHOLD = 15;

const HEADER_KEYWORDS = [
  /item|description|product|المنتج|الصنف|الوصف/i,
  /qty|quantity|الكمية|كمية/i,
  /unit|الوحدة/i,
  /price|سعر|السعر/i,
  /total|الإجمالي|مجموع/i,
];

function groupRowsByY(lines: OcrLine[]): OcrLine[][] {
  const sorted = [...lines].sort((a, b) => {
    const ay = (a.box.y1 + a.box.y2) / 2;
    const by = (b.box.y1 + b.box.y2) / 2;
    return ay - by;
  });

  const rows: OcrLine[][] = [];
  let currentRow: OcrLine[] = [];
  let lastY = -9999;

  for (const line of sorted) {
    const midY = (line.box.y1 + line.box.y2) / 2;
    if (Math.abs(midY - lastY) <= Y_THRESHOLD) {
      currentRow.push(line);
    } else {
      if (currentRow.length > 0) rows.push(currentRow);
      currentRow = [line];
      lastY = midY;
    }
  }
  if (currentRow.length > 0) rows.push(currentRow);

  return rows.map((row) => row.sort((a, b) => a.box.x1 - b.box.x1));
}

function isHeaderRow(rowText: string): boolean {
  const matchCount = HEADER_KEYWORDS.filter((kw) => kw.test(rowText)).length;
  return matchCount >= 2;
}

function parseLineItem(
  cells: string[],
  avgConfidence: number,
): ExtractedLineItem | null {
  if (cells.length < 2) return null;

  const rawName = cells[0].trim();
  if (!rawName || rawName.length < 2) return null;

  const numericCells = cells
    .slice(1)
    .map((c) => normalizeAmount(normalizeText(c)));
  const numbers = numericCells.filter((n): n is number => n !== null);

  let quantity: number | undefined;
  let unitPrice: number | undefined;
  let lineTotal: number | undefined;
  let unit: string | undefined;

  if (numbers.length === 1) {
    lineTotal = numbers[0];
  } else if (numbers.length === 2) {
    [unitPrice, lineTotal] = numbers;
  } else if (numbers.length >= 3) {
    [quantity, unitPrice, lineTotal] = numbers;
  }

  const unitMatch =
    /\b(kg|g|ltr|ml|pcs|box|carton|كيلو|لتر|كرتون|صندوق|قطعة)\b/i.exec(rawName);
  if (unitMatch) unit = unitMatch[1];

  const needsReview = avgConfidence < 0.8 || !lineTotal;

  return {
    rawName,
    quantity,
    unit,
    unitPrice,
    lineTotal,
    confidence: avgConfidence,
    needsReview,
  };
}

export function extractLineItemsFromOcr(lines: OcrLine[]): ExtractedLineItem[] {
  if (!lines || lines.length === 0) return [];

  const rows = groupRowsByY(lines);
  const items: ExtractedLineItem[] = [];
  let inTable = false;

  for (const row of rows) {
    const rowText = row.map((l) => l.text).join(' ');
    const avgConf = row.reduce((sum, l) => sum + l.confidence, 0) / row.length;

    if (isHeaderRow(rowText)) {
      inTable = true;
      continue;
    }

    if (!inTable) continue;

    const rawCells = row.map((l) => l.text);
    // If a single OCR cell contains multiple columns separated by 2+ spaces, split it
    const cells =
      rawCells.length === 1 ? rawCells[0].split(/\s{2,}/) : rawCells;
    const item = parseLineItem(cells, avgConf);
    if (item) items.push(item);
  }

  if (items.length === 0 && rows.length > 0) {
    for (const row of rows) {
      const cells = row.map((l) => l.text);
      const avgConf =
        row.reduce((sum, l) => sum + l.confidence, 0) / row.length;
      const item = parseLineItem(cells, avgConf);
      if (item) items.push(item);
    }
  }

  return items;
}
