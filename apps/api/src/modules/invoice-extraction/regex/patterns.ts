/* ── Money amount capture (reused across pattern sets) ── */
const MONEY = String.raw`([0-9]+(?:[,.][0-9]{1,2})?)`;

/* ── Invoice number ── */
export const INVOICE_NUMBER_PATTERNS: RegExp[] = [
  /(?:فاتور[ةه]\s*#?|#\s*فاتور[ةه])\s*[:#-]?\s*([0-9A-Z/-]+)/iu,
  /(?:رقم\s*الفاتور[ةه]|فاتور[ةه]\s*رقم)\s*[:#-]?\s*([0-9A-Z/-]+)/iu,
  /(?:invoice\s*(?:no|number|#)?|inv\s*no)\s*[:#-]?\s*([A-Z0-9/-]+)/i,
  /(?:tax\s*invoice\s*no)\s*[:#-]?\s*([A-Z0-9/-]+)/i,
];

/* ── Order number ── */
export const ORDER_NUMBER_PATTERNS: RegExp[] = [
  /(?:طلب|order)\s*#?\s*([0-9]+)/iu,
  /#\s*([0-9]+)\s*(?:طلب|order)/iu,
];

/* ── VAT / tax registration number (15-digit Saudi) ── */
export const VAT_NUMBER_PATTERNS: RegExp[] = [
  /(?:الرقم\s*الضريبي|رقم\s*ضريبي|الرقم\s*الضريبى)\s*[:#-]?\s*([0-9]{15})/iu,
  /(?:vat\s*(?:no|number)?|tax\s*(?:no|number)|trn)\s*[:#-]?\s*([0-9]{15})/i,
  /\b(3[0-9]{13}3)\b/,
];

/* ── Date ── */
export const DATE_PATTERNS: RegExp[] = [
  /(?:وقت\s*الطباعة|وقت\s*الطلب|تاريخ\s*الفاتور[ةه]|التاريخ)\s*[:-]?\s*(\d{4}[/.-]\d{1,2}[/.-]\d{1,2})/iu,
  /(?:invoice\s*date|date)\s*[:-]?\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})/i,
  /(\d{4}[/.-]\d{1,2}[/.-]\d{1,2})/,
  /(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})/,
  /\b((?:19|20)\d{6})\b/,
];

/* ── Keyword sets for line-based amount extraction ── */
export const SUBTOTAL_KEYWORDS: RegExp[] = [
  /المجموع\s*الفرعي/iu,
  /الفرعي\s*المجموع/iu,
  /المجموع\s*قبل\s*الضريبة/iu,
  /الإجمالي\s*قبل\s*الضريبة/iu,
  /قبل\s*الضريبة/iu,
  /subtotal/i,
  /sub\s*total/i,
  /amount\s*before\s*vat/i,
];

export const VAT_AMOUNT_KEYWORDS: RegExp[] = [
  /ضريبة\s*القيمة\s*المضافة/iu,
  /المضافة\s*القيمة\s*.*ضريبة/iu,
  /القيمة\s*المضافة/iu,
  /المضافة\s*القيمة/iu,
  /vat/i,
  /value\s*added\s*tax/i,
];

export const TOTAL_KEYWORDS: RegExp[] = [
  /الإجمالي/iu,
  /المجموع\s*الكلي/iu,
  /المبلغ\s*المستحق/iu,
  /grand\s*total/i,
  /total\s*amount/i,
  /amount\s*due/i,
  /total/i,
];

export const TOTAL_EXCLUDE_KEYWORDS: RegExp[] = [
  /المجموع\s*الفرعي/iu,
  /الفرعي\s*المجموع/iu,
  /subtotal/i,
  /sub\s*total/i,
  /ضريبة/iu,
  /vat/i,
  /قبل\s*الضريبة/iu,
  /الدفع/iu,
  /payment/i,
  /التقريب/iu,
  /rounding/i,
];

/* ── Legacy regex arrays (kept for backward compat / fallback) ── */
export const SUBTOTAL_PATTERNS: RegExp[] = [
  new RegExp(
    String.raw`(?:المجموع\s*الفرعي|الفرعي\s*المجموع|Subtotal|sub\s*total)[^\n]*?(?:SAR\s*)?${MONEY}`,
    'iu',
  ),
  new RegExp(
    String.raw`(?:SAR\s*)?${MONEY}[^\n]*?(?:المجموع\s*الفرعي|الفرعي\s*المجموع|Subtotal)`,
    'iu',
  ),
];

export const VAT_AMOUNT_PATTERNS: RegExp[] = [
  new RegExp(
    String.raw`(?:ضريبة\s*القيمة\s*المضافة|VAT|value\s*added\s*tax)[^\n]*?(?:\(?\s*[0-9]+(?:\.[0-9]+)?\s*%\s*\)?)?[^\n]*?SAR\s*${MONEY}`,
    'iu',
  ),
  new RegExp(
    String.raw`SAR\s*${MONEY}[^\n]*?(?:ضريبة\s*القيمة\s*المضافة|VAT)`,
    'iu',
  ),
];

export const TOTAL_PATTERNS: RegExp[] = [
  new RegExp(
    String.raw`(?:الإجمالي|Total|grand\s*total|amount\s*due)[^\n]*?SAR\s*${MONEY}`,
    'iu',
  ),
  new RegExp(
    String.raw`SAR\s*${MONEY}[^\n]*?(?:الإجمالي|Total|grand\s*total|amount\s*due)`,
    'iu',
  ),
];

/* ── Supplier name ── */
export const SUPPLIER_NAME_PATTERNS: RegExp[] = [
  /((?:شركة|مؤسسة)\s+[\u0600-\u06FF\s]{3,80})(?=\n|\s+الرقم\s*الضريبي|\s+[0-9]{15})/iu,
  /(?:supplier|vendor|sold\s*by|from)\s*[:-]?\s*([A-Za-z\u0600-\u06FF][A-Za-z\u0600-\u06FF\s]{2,80})/i,
  /(?:المورد|البائع)\s*[:-]\s*([\u0600-\u06FF][^\d:#\n]{3,80})/iu,
];

/* ── Line item row pattern ── */
export const LINE_ITEM_PATTERN =
  /^\s*(?<quantity>[0-9]+(?:[,.][0-9]+)?)\s+(?<name>.+?)\s+SAR\s*(?<lineTotal>[0-9]+(?:[,.][0-9]{1,2})?)\s*$/iu;

export const FOOTER_KEYWORDS =
  /(?:المجموع|الفرعي|Subtotal|ضريبة|VAT|الإجمالي|Total|عدد\s*المنتجات|الرقم\s*الضريبي|شركة|مؤسسة|التقريب|Rounding|الدفع|payment)/iu;

/** Lines that must never be treated as product items */
export const STOP_LINE_KEYWORDS =
  /(?:المجموع|Subtotal|ضريبة|VAT|الإجمالي|Total|التقريب|Rounding|الدفع|payment|card|مدى|visa|mastercard|cash|نقد|الرقم\s*الضريبي|شركة|مؤسسة|فاتور[ةه]|invoice|الطلب|order|المنشئ|المغلق|وقت\s*الطباعة|وقت\s*الطلب|Simplified|استلام|pickup|delivery|توصيل)/iu;

/** Section detection markers */
export const SECTION_MARKERS = {
  HEADER:
    /(?:فاتور[ةه]|invoice|tax\s*invoice|الطلب|order|وقت\s*الطباعة|استلام|المنشئ|المغلق|Simplified)/iu,
  ITEMS_START:
    /(?:الكمية|وحدة|السعر|quantity|price|unit|المنتج|product|الوصف|description)/iu,
  TOTALS:
    /(?:المجموع\s*الفرعي|Subtotal|ضريبة|VAT|الإجمالي|Total|التقريب|Rounding)/iu,
  FOOTER:
    /(?:الدفع|payment|card|مدى|visa|cash|نقد|شركة|مؤسسة|الرقم\s*الضريبي)/iu,
};
