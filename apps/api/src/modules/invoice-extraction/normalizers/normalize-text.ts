import { normalizeArabicDigits } from './normalize-arabic-digits';

/**
 * Full invoice text normalizer — Arabic/Persian digits, bidi chars,
 * spelling variants, currency symbols, whitespace.
 */
export function normalizeInvoiceText(input: string): string {
  return input
    .replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (d) => {
      const code = d.charCodeAt(0);
      if (code >= 0x0660 && code <= 0x0669) return String(code - 0x0660);
      return String(code - 0x06f0);
    })
    .replace(/[\u200F\u200E\u202A\u202B\u202C\uFEFF]/g, '')
    .replace(/إجمالى/g, 'إجمالي')
    .replace(/ضريبه/g, 'ضريبة')
    .replace(/فاتوره/g, 'فاتورة')
    .replace(/ر\.س|ريال|﷼/g, 'SAR')
    .replace(/SAR\s*:/gi, 'SAR')
    .replace(/،/g, ',')
    .replace(/٫/g, '.')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

/** Legacy alias — collapses newlines to spaces */
export function normalizeText(input: string): string {
  return normalizeInvoiceText(input).replace(/\n/g, ' ');
}

export function normalizeAmount(value: string): number | null {
  const cleaned = value.replace(/,/g, '').replace(/\s/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function validDateParts(y: number, m: number, d: number): boolean {
  return y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31;
}

/**
 * Recover a date from noisy OCR digit runs.
 * Example: "041502320231212" → "2023-12-12"
 * Tries the last 8 and first 8 digits of each run ≥ 8 chars.
 */
export function extractDateFromDigitRuns(text: string): string | null {
  const normalized = normalizeArabicDigits(text);
  const runs = normalized.match(/\d{8,}/g) ?? [];

  for (const run of runs) {
    const candidates = [run.slice(-8), run.slice(0, 8)];

    for (const c of candidates) {
      const yyyy = c.slice(0, 4);
      const mm = c.slice(4, 6);
      const dd = c.slice(6, 8);
      if (validDateParts(+yyyy, +mm, +dd)) {
        return `${yyyy}-${mm}-${dd}`;
      }
    }
  }

  return null;
}

export function normalizeDate(value: string): string | null {
  const clean = normalizeArabicDigits(value.trim());

  // Compact YYYYMMDD (e.g. 20231212) — only allow 19xx/20xx years
  const compact = /^((?:19|20)\d{2})(\d{2})(\d{2})$/.exec(clean);
  if (compact) {
    const [, y, m, d] = compact;
    if (validDateParts(+y, +m, +d)) return `${y}-${m}-${d}`;
  }

  // DMY with separator (e.g. 12/12/2023)
  const dmy = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/.exec(clean);
  if (dmy) {
    const [, dd, mm, yyyy] = dmy;
    if (validDateParts(+yyyy, +mm, +dd)) {
      return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
    }
  }

  // YMD with separator (e.g. 2023/12/12)
  const ymd = /^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/.exec(clean);
  if (ymd) {
    const [, yyyy, mm, dd] = ymd;
    if (validDateParts(+yyyy, +mm, +dd)) {
      return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
    }
  }

  return null;
}
