import {
  normalizeInvoiceText,
  normalizeDate,
  extractDateFromDigitRuns,
} from '../normalizers/normalize-text';
import {
  INVOICE_NUMBER_PATTERNS,
  ORDER_NUMBER_PATTERNS,
  VAT_NUMBER_PATTERNS,
  DATE_PATTERNS,
  SUBTOTAL_KEYWORDS,
  VAT_AMOUNT_KEYWORDS,
  TOTAL_KEYWORDS,
  TOTAL_EXCLUDE_KEYWORDS,
  SUPPLIER_NAME_PATTERNS,
} from '../regex/patterns';
import {
  extractAmountFromLine,
  findAmountByKeywords,
  findAmountNearKeyword,
  findAmountNearKeywordStrict,
} from './line-based-amount.extractor';

function firstMatch(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match?.[1]) return normalizeInvoiceText(match[1]);
  }
  return null;
}

/**
 * Extract supplier VAT number, preferring the footer/bottom half
 * of the text. Falls back to any 15-digit number starting with 3.
 */
function extractVatNumber(flat: string, lines: string[]): string | undefined {
  // 1. Try labeled pattern on full text
  const labeled = firstMatch(flat, VAT_NUMBER_PATTERNS.slice(0, 2));
  if (labeled) return labeled;

  // 2. Try footer section (bottom third of lines)
  const footerStart = Math.max(0, Math.floor(lines.length * 0.6));
  const footerText = lines.slice(footerStart).join(' ');
  const footerMatch = firstMatch(footerText, VAT_NUMBER_PATTERNS);
  if (footerMatch) return footerMatch;

  // 3. Fallback: any 15-digit 3…3 pattern anywhere
  const fallback = firstMatch(flat, [/\b(3[0-9]{13}3)\b/]);
  return fallback ?? undefined;
}

export interface HeaderExtractionResult {
  supplierName?: string;
  supplierVatNumber?: string;
  invoiceNumber?: string;
  orderNumber?: string;
  invoiceDate?: string;
  subtotal?: number;
  vatAmount?: number;
  total?: number;
  currency: string;
  confidence: number;
  warnings: string[];
}

export function extractHeader(rawText: string): HeaderExtractionResult {
  const normalized = normalizeInvoiceText(rawText);
  const flat = normalized.replace(/\n/g, ' ');
  const lines = normalized
    .split('\n')
    .map((l) => normalizeInvoiceText(l))
    .filter(Boolean);
  const warnings: string[] = [];

  // ── Header fields ──
  const invoiceNumber = firstMatch(flat, INVOICE_NUMBER_PATTERNS) ?? undefined;
  const orderNumber = firstMatch(flat, ORDER_NUMBER_PATTERNS) ?? undefined;
  const vatNumber = extractVatNumber(flat, lines);

  const dateRaw = firstMatch(flat, DATE_PATTERNS);
  const invoiceDate =
    (dateRaw ? (normalizeDate(dateRaw) ?? null) : null) ??
    extractDateFromDigitRuns(flat) ??
    undefined;

  // ── Amounts — strict keyword-adjacent extraction ──

  // Lines that should never provide a subtotal/VAT/total value
  const nonAmountLines = [
    /ضريبة|vat/iu,
    /المجموع\s*الفرعي|subtotal/iu,
    /الإجمالي|total/iu,
    /التقريب|rounding/iu,
    /الدفع|payment|card|cash|نقد|مدى|visa/iu,
    /الرقم\s*الضريبي/iu,
  ];

  // Subtotal: Arabic keyword preferred, strict window, exclude total/VAT lines
  const SUBTOTAL_KW = /المجموع\s*الفرعي|الفرعي\s*المجموع|المجموع\s*قبل\s*الضريبة|قبل\s*الضريبة|subtotal|sub\s*total|amount\s*before\s*vat/iu;
  const subtotalStrict = findAmountNearKeywordStrict(lines, SUBTOTAL_KW, {
    windowBefore: 1,
    windowAfter: 2,
    preferArabicLabel: true,
    exclude: [/الإجمالي|total/iu, /ضريبة|vat/iu, /التقريب|rounding/iu],
  });
  const subtotal =
    subtotalStrict ?? findAmountByKeywords(lines, SUBTOTAL_KEYWORDS) ?? undefined;

  // VAT: Arabic keyword preferred, bidirectional window, exclude subtotal/total lines
  const VAT_KW = /ضريبة\s*القيمة\s*المضافة|القيمة\s*المضافة|المضافة\s*القيمة|vat|value\s*added\s*tax/iu;
  const vatStrict = findAmountNearKeywordStrict(lines, VAT_KW, {
    windowBefore: 2,
    windowAfter: 2,
    preferArabicLabel: true,
    exclude: [/المجموع\s*الفرعي|subtotal/iu, /الإجمالي|total/iu, /التقريب/iu],
  });
  let vatAmount =
    vatStrict ??
    findAmountByKeywords(lines, VAT_AMOUNT_KEYWORDS) ??
    findAmountNearKeyword(lines, /ضريبة|VAT/iu, 2) ??
    undefined;

  // Total: last occurrence of الإجمالي/Total, exclude all non-total lines
  const TOTAL_KW =
    /الإجمالي|المجموع\s*الكلي|المبلغ\s*المستحق|grand\s*total|total\s*amount|amount\s*due/iu;
  const totalCandidates: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!TOTAL_KW.test(lines[i])) continue;
    if (
      nonAmountLines.some(
        (ex) => ex.test(lines[i]) && !/الإجمالي/iu.test(lines[i]),
      )
    )
      continue;
    const inline = extractAmountFromLine(lines[i]);
    if (inline !== null) {
      totalCandidates.push(inline);
      continue;
    }
    for (let j = 1; j <= 2; j++) {
      if (i + j >= lines.length) break;
      if (nonAmountLines.some((ex) => ex.test(lines[i + j]))) continue;
      const amt = extractAmountFromLine(lines[i + j]);
      if (amt !== null) {
        totalCandidates.push(amt);
        break;
      }
    }
  }
  let total: number | undefined =
    totalCandidates.length > 0
      ? totalCandidates[totalCandidates.length - 1]
      : (findAmountByKeywords(lines, TOTAL_KEYWORDS, {
          preferLast: true,
          exclude: TOTAL_EXCLUDE_KEYWORDS,
        }) ?? undefined);

  // Fallback: compute from subtotal + vat
  if (!total && subtotal && vatAmount) {
    total = Math.round((subtotal + vatAmount) * 100) / 100;
  }

  // Guard: if subtotal equals total and vatAmount > 0, something was mis-extracted
  if (subtotal && total && vatAmount && Math.abs(subtotal - total) < 0.01) {
    vatAmount = undefined;
  }

  // ── Supplier ──
  const rawSupplier = firstMatch(normalized, SUPPLIER_NAME_PATTERNS);
  const supplierName = rawSupplier
    ? rawSupplier.split('\n')[0].trim() || undefined
    : undefined;

  // ── Currency ──
  let currency = 'SAR';
  if (/USD|\$/.test(flat)) currency = 'USD';
  else if (/EUR|€/.test(flat)) currency = 'EUR';

  // ── Warnings ──
  if (!invoiceNumber) warnings.push('Invoice number not detected');
  if (!invoiceDate) warnings.push('Invoice date not detected');
  if (!total) warnings.push('Total amount not detected');
  if (!vatNumber && currency === 'SAR') {
    warnings.push('Supplier VAT number not detected');
  }

  const fieldsFound = [
    invoiceNumber,
    vatNumber,
    invoiceDate,
    subtotal,
    total,
  ].filter(Boolean).length;
  const confidence = Math.min(1, fieldsFound / 4);

  return {
    supplierName,
    supplierVatNumber: vatNumber,
    invoiceNumber,
    orderNumber,
    invoiceDate: invoiceDate ?? undefined,
    subtotal,
    vatAmount,
    total,
    currency,
    confidence,
    warnings,
  };
}
