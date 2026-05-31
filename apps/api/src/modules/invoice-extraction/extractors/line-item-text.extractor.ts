import { normalizeInvoiceText } from '../normalizers/normalize-text';
import {
  LINE_ITEM_PATTERN,
  FOOTER_KEYWORDS,
  STOP_LINE_KEYWORDS,
} from '../regex/patterns';

export interface TextLineItem {
  rawName: string;
  quantity: number;
  unitPrice?: number;
  lineTotal: number;
  notes: string[];
  confidence: number;
  needsReview: boolean;
}

/** Regex to extract SAR amount from a line */
const SAR_AMOUNT_RE = /SAR\s*([0-9]+(?:[,.][0-9]{1,2})?)/i;

/** Check if a line is ONLY a small integer (potential quantity) */
const BARE_QTY_RE = /^\s*([0-9]+(?:[,.][0-9]+)?)\s*$/;

/** Lines that look like OCR junk: single/double chars, lone symbols */
const JUNK_LINE_RE =
  /^[^\u0600-\u06FFa-zA-Z0-9]{0,2}$|^[a-zA-Z\u0600-\u06FF]{1,2}$/u;

/** Header row keywords to skip */
const HEADER_RE = /الكمية|وحدة|السعر|quantity|price|unit/iu;

function pushItem(
  items: TextLineItem[],
  qty: number,
  nameParts: string[],
  total: number,
): void {
  const rawName = nameParts.join(' ').trim();
  if (!rawName) return;
  const missingAmount = total === 0;
  items.push({
    rawName,
    quantity: qty,
    lineTotal: total,
    unitPrice:
      qty > 0 && total > 0 ? Number((total / qty).toFixed(2)) : undefined,
    notes: [],
    confidence: missingAmount ? 0.5 : 0.85,
    needsReview: missingAmount,
  });
}

/**
 * Extract line items from raw OCR text lines.
 *
 * Handles two layouts:
 * 1. Single-line: "1 Babka Chocolate باباكا تشوكلت SAR 17.00"
 * 2. Multi-line (real PaddleOCR output):
 *      "1"
 *      "باباكا تشوكلت"
 *      "SAR 17.00"
 */
export function extractLineItemsFromText(rawLines: string[]): TextLineItem[] {
  const items: TextLineItem[] = [];

  // Accumulator state for multi-line items
  let pendingQty: number | null = null;
  let nameParts: string[] = [];
  const orphanLines: string[] = [];

  for (const rawLine of rawLines) {
    const line = normalizeInvoiceText(rawLine);
    if (!line) continue;

    // Skip header rows (الكمية, السعر, etc.)
    if (HEADER_RE.test(line) && !SAR_AMOUNT_RE.test(line)) continue;

    // Stop at footer/totals rows once we have items or a pending qty
    if (FOOTER_KEYWORDS.test(line)) {
      if (items.length > 0 || pendingQty !== null) {
        pendingQty = null;
        nameParts = [];
        break;
      }
      continue;
    }

    // Skip non-item lines (invoice metadata, payment, etc.)
    if (STOP_LINE_KEYWORDS.test(line) && !SAR_AMOUNT_RE.test(line)) {
      continue;
    }

    // Skip junk-only lines when not in mid-accumulation
    if (JUNK_LINE_RE.test(line) && nameParts.length === 0) {
      continue;
    }

    // ── Try single-line match first ──
    const singleMatch = LINE_ITEM_PATTERN.exec(line);
    if (singleMatch?.groups) {
      const qty = Number(singleMatch.groups.quantity.replace(',', '.'));
      const total = Number(singleMatch.groups.lineTotal.replace(',', '.'));
      if (qty <= 999) {
        pendingQty = null;
        nameParts = [];
        pushItem(items, qty, [singleMatch.groups.name.trim()], total);
      }
      continue;
    }

    // ── Multi-line mode ──

    // Is this line an SAR amount?
    const sarMatch = SAR_AMOUNT_RE.exec(line);
    if (sarMatch) {
      const preText = line.substring(0, sarMatch.index).trim();
      const total = Number(sarMatch[1].replace(',', ''));
      if (pendingQty !== null) {
        if (preText) nameParts.push(preText);
        pushItem(items, pendingQty, nameParts, total);
        pendingQty = null;
        nameParts = [];
        orphanLines.length = 0;
      } else if (orphanLines.length > 0) {
        // Build an item from orphan lines accumulated since last item
        if (preText) orphanLines.push(preText);
        pushItem(items, 1, [...orphanLines], total);
        orphanLines.length = 0;
      } else if (items.length > 0) {
        // Patch total into last item if it has no amount yet
        const last = items[items.length - 1];
        if (last.lineTotal === 0) {
          last.lineTotal = total;
          last.unitPrice = Number((total / last.quantity).toFixed(2));
          last.confidence = 0.75;
          last.needsReview = false;
        }
      }
      continue;
    }

    // Is this line a bare quantity?
    const qtyMatch = BARE_QTY_RE.exec(line);
    if (qtyMatch) {
      const qty = Number(qtyMatch[1].replace(',', '.'));
      if (qty > 0 && qty <= 999) {
        // A bare quantity always starts a new item.
        // Flush any pending partial first (no SAR found = missing amount).
        if (pendingQty !== null && nameParts.length > 0) {
          pushItem(items, pendingQty, nameParts, 0);
        }
        pendingQty = qty;
        nameParts = [];
        continue;
      }
    }

    // Accumulate as name part (only if we have a pending quantity)
    if (pendingQty !== null) {
      nameParts.push(line);
      continue;
    }

    // No pending qty and not an SAR line — collect as orphan for next SAR
    if (items.length > 0 && !JUNK_LINE_RE.test(line)) {
      orphanLines.push(line);
    }
  }

  // Flush any pending partial item (no SAR amount found before end/footer)
  if (pendingQty !== null && nameParts.length > 0) {
    pushItem(items, pendingQty, nameParts, 0);
  }

  return items;
}
