import {
  normalizeInvoiceText,
  normalizeAmount,
} from '../normalizers/normalize-text';

/**
 * Extract an SAR amount from a single normalized line.
 * Tries SAR prefix then SAR suffix.
 */
export function extractAmountFromLine(line: string): number | null {
  const normalized = normalizeInvoiceText(line);

  const match =
    normalized.match(/SAR\s*([0-9]+(?:[,.][0-9]{1,2})?)/i) ??
    normalized.match(/([0-9]+(?:[,.][0-9]{1,2})?)\s*SAR/i);

  if (!match) return null;
  return normalizeAmount(match[1]);
}

/**
 * Find an SAR amount near a keyword with a bi-directional window.
 * Looks at the keyword line, then forward, then backward.
 */
export function findAmountNearKeyword(
  lines: string[],
  keyword: RegExp,
  windowSize = 2,
): number | null {
  const normalized = lines.map((l) => normalizeInvoiceText(l));
  for (let i = 0; i < normalized.length; i++) {
    if (!keyword.test(normalized[i])) continue;

    // Try the keyword line itself
    const inline = extractAmountFromLine(normalized[i]);
    if (inline !== null) return inline;

    // Look forward
    for (let j = 1; j <= windowSize; j++) {
      if (i + j >= normalized.length) break;
      const amt = extractAmountFromLine(normalized[i + j]);
      if (amt !== null) return amt;
    }

    // Look backward
    for (let j = 1; j <= windowSize; j++) {
      if (i - j < 0) break;
      const amt = extractAmountFromLine(normalized[i - j]);
      if (amt !== null) return amt;
    }
  }
  return null;
}

export interface FindAmountOptions {
  preferLast?: boolean;
  exclude?: RegExp[];
}

export interface FindAmountStrictOptions {
  windowBefore?: number;
  windowAfter?: number;
  exclude?: RegExp[];
  preferArabicLabel?: boolean;
}

/**
 * Find an SAR amount strictly near a keyword line.
 *
 * Rules:
 * 1. Normalize all lines.
 * 2. Find the keyword line (skip excluded lines).
 * 3. Check the same line for an inline amount.
 * 4. Check up to windowAfter lines forward.
 * 5. Check up to windowBefore lines backward (only if forward found nothing).
 * 6. Excluded lines forward from keyword are stop boundaries (search stops). Backward: skipped.
 * 7. If preferArabicLabel=true, Arabic keyword matches are tried before English.
 * 8. Returns the first valid SAR amount found.
 */
export function findAmountNearKeywordStrict(
  lines: string[],
  keyword: RegExp,
  options?: FindAmountStrictOptions,
): number | null {
  const windowBefore = options?.windowBefore ?? 2;
  const windowAfter = options?.windowAfter ?? 3;
  const exclude = options?.exclude ?? [];
  const normalized = lines.map((l) => normalizeInvoiceText(l));

  // Collect all keyword hit indices, separating Arabic vs. English if needed
  const arabicHits: number[] = [];
  const englishHits: number[] = [];
  const ARABIC_RE = /[\u0600-\u06FF]/;

  for (let i = 0; i < normalized.length; i++) {
    if (!keyword.test(normalized[i])) continue;
    if (exclude.some((ex) => ex.test(normalized[i]))) continue;
    if (options?.preferArabicLabel && ARABIC_RE.test(normalized[i])) {
      arabicHits.push(i);
    } else {
      englishHits.push(i);
    }
  }

  const hitIndices =
    options?.preferArabicLabel && arabicHits.length > 0
      ? arabicHits
      : arabicHits.concat(englishHits);

  for (const i of hitIndices) {
    // 1. Same line
    const inline = extractAmountFromLine(normalized[i]);
    if (inline !== null) return inline;

    // 2. Look forward (up to windowAfter; excluded lines are stop boundaries)
    for (let j = 1; j <= windowAfter; j++) {
      if (i + j >= normalized.length) break;
      const candidate = normalized[i + j];
      if (exclude.some((ex) => ex.test(candidate))) break;
      const amt = extractAmountFromLine(candidate);
      if (amt !== null) return amt;
    }

    // 3. Look backward (up to windowBefore, skip excluded lines)
    for (let j = 1; j <= windowBefore; j++) {
      if (i - j < 0) break;
      const candidate = normalized[i - j];
      if (exclude.some((ex) => ex.test(candidate))) continue;
      const amt = extractAmountFromLine(candidate);
      if (amt !== null) return amt;
    }
  }

  return null;
}

interface SearchEntry {
  text: string;
  /** First original-line index covered by this entry */
  startIdx: number;
  /** Last original-line index covered by this entry */
  endIdx: number;
  /** True when this entry merges multiple original lines */
  merged: boolean;
}

const LOOKAHEAD = 3;

/**
 * Build search entries: each original line plus merged 2- and 3-line
 * windows so that keywords split across OCR lines can be matched.
 */
function buildSearchEntries(normalized: string[]): SearchEntry[] {
  const entries: SearchEntry[] = [];
  for (let i = 0; i < normalized.length; i++) {
    entries.push({
      text: normalized[i],
      startIdx: i,
      endIdx: i,
      merged: false,
    });
    if (i < normalized.length - 1) {
      entries.push({
        text: normalized.slice(i, i + 2).join(' '),
        startIdx: i,
        endIdx: i + 1,
        merged: true,
      });
    }
    if (i < normalized.length - 2) {
      entries.push({
        text: normalized.slice(i, i + 3).join(' '),
        startIdx: i,
        endIdx: i + 2,
        merged: true,
      });
    }
  }
  return entries;
}

/**
 * Scan lines (and merged windows) for a keyword, then extract
 * the SAR amount from the same window or adjacent original lines.
 */
export function findAmountByKeywords(
  lines: string[],
  keywords: RegExp[],
  options?: FindAmountOptions,
): number | null {
  const candidates: number[] = [];
  const normalized = lines.map((l) => normalizeInvoiceText(l));
  const entries = buildSearchEntries(normalized);

  for (const entry of entries) {
    const hasKeyword = keywords.some((k) => k.test(entry.text));
    const isExcluded =
      options?.exclude?.some((k) => k.test(entry.text)) ?? false;

    if (!hasKeyword || isExcluded) continue;

    let amount: number | null = null;

    if (!entry.merged) {
      // Single line: try extracting from the line itself
      amount = extractAmountFromLine(entry.text);
    } else {
      // Merged window: only check the last constituent line to avoid
      // picking up amounts from unrelated preceding lines
      amount = extractAmountFromLine(normalized[entry.endIdx]);
    }

    // If no amount found yet, look ahead past the window
    if (amount === null) {
      const start = entry.endIdx + 1;
      for (
        let j = start;
        j < Math.min(start + LOOKAHEAD, normalized.length);
        j++
      ) {
        amount = extractAmountFromLine(normalized[j]);
        if (amount !== null) break;
      }
    }

    if (amount !== null) {
      candidates.push(amount);
    }
  }

  if (candidates.length === 0) return null;

  return options?.preferLast
    ? candidates[candidates.length - 1]
    : candidates[0];
}
