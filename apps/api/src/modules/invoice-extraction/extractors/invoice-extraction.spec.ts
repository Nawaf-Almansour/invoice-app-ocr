import { extractHeader } from './invoice-header.extractor';
import { extractLineItemsFromText } from './line-item-text.extractor';
import {
  extractAmountFromLine,
  findAmountByKeywords,
  findAmountNearKeyword,
  findAmountNearKeywordStrict,
} from './line-based-amount.extractor';
import {
  normalizeDate,
  extractDateFromDigitRuns,
} from '../normalizers/normalize-text';

/**
 * Receipt 1 — invoice #101347, 6 items, subtotal 86.96, VAT 13.04, total 100.00
 * Multi-line PaddleOCR output (each element on its own line).
 */
const RECEIPT_1_LINES = [
  'المونسيه.. طريق الثمامه',
  'الرقم الضريبي',
  '310227420600003',
  'Simplified Tax Invoice',
  'الطلب# ٦٩',
  'وقت الطباعة 2021/11/14 09:19:08',
  'استلام',
  'فاتورة# 101347',
  'وقت الطلب 2021/11/14 08:01:30',
  'المنشئ saeid',
  'المغلق saeid',
  'الكمية وحدة السعر',
  '1',
  'باباكا تشوكلت',
  'Babka Chocolate',
  'SAR 17.00',
  '1',
  'بودينغ القهوة والموز',
  'Pudding',
  'SAR 24.00',
  '1',
  'بسكت الجبن وال',
  'شبت',
  'Cheese-dill biscuit',
  'SAR 12.00',
  '1',
  'شريحة ك',
  'يكة التوت الأزرق',
  'slice of blue berry cake',
  'SAR 15.00',
  '1',
  'اسبريسو + حليب',
  'Espresso w/milk',
  'SAR 3.96',
  'Regular Temp, Full',
  'فلات وايت, Falt White',
  'Fat2',
  '1',
  'شاي أنجليزي',
  'English Brunch Tea',
  'SAR 15.00',
  'المجموع الفرعي',
  'SAR 86.96',
  'Subtotal',
  'ضريبة القيمة المضافة (15.0%) SAR 13.04',
  'الإجمالي SAR 100.00',
  'Total',
  'شركة شفرة نحاسية لتقديم المشروبات',
  'الرقم الضريبي 310227420600003',
];

const RECEIPT_1_RAW = RECEIPT_1_LINES.join('\n');

/**
 * Receipt 2 — invoice #232130, 3 items, subtotal 43.47, VAT 6.52, total 50.00
 * Single-line format.
 */
const RECEIPT_2_LINES = [
  'المونسيه.. طريق الثمامه',
  'الرقم الضريبي : 302281309900003',
  'Simplified Tax Invoice',
  'الطلب# 302',
  'وقت الطباعة: ١٢/١٢/٢٠٢٣ ١٥:٢٣:٠٤ م',
  'استلام',
  'فاتورة# 232130',
  '١٢/١٢/٢٠٢٣ ١٤:١٤:٤٣ م',
  'saeid :المنشئ',
  'saeid :المغلق',
  'الكمية وحدة السعر',
  '1 coffee day قهوه اليوم SAR 7.82',
  '1 Flat wight فلات وايت - SAR 13.91',
  '1 Dates cake.. كيكة التمر الايس كريم SAR 21.74',
  'with ice cream',
  'المجموع الفرعي SAR 43.47',
  'Subtotal',
  '(15.0%)ضريبة القيمة المضافة SAR 6.52',
  'التقريب SAR 0.01',
  'Rounding',
  'الإجمالي SAR 50.00',
  'Total',
  'الدفع - شبكة card SAR 50.00',
];

const RECEIPT_2_RAW = RECEIPT_2_LINES.join('\n');

// ─── extractAmountFromLine ────────────────────────────────────────────
describe('extractAmountFromLine', () => {
  it('extracts SAR prefix amount', () => {
    expect(extractAmountFromLine('SAR 17.00')).toBe(17);
  });

  it('extracts SAR suffix amount', () => {
    expect(extractAmountFromLine('100.00 SAR')).toBe(100);
  });

  it('returns null for line without SAR', () => {
    expect(extractAmountFromLine('some text 123')).toBeNull();
  });
});

// ─── findAmountNearKeyword ────────────────────────────────────────────
describe('findAmountNearKeyword', () => {
  it('finds amount on the same line', () => {
    const lines = ['some text', 'ضريبة القيمة المضافة SAR 13.04', 'other'];
    expect(findAmountNearKeyword(lines, /ضريبة/iu)).toBe(13.04);
  });

  it('finds amount on the next line', () => {
    const lines = ['ضريبة القيمة المضافة', 'SAR 13.04', 'other'];
    expect(findAmountNearKeyword(lines, /ضريبة/iu)).toBe(13.04);
  });

  it('finds amount on the previous line (backward lookup)', () => {
    const lines = ['other', 'SAR 13.04', 'ضريبة القيمة المضافة'];
    expect(findAmountNearKeyword(lines, /ضريبة/iu)).toBe(13.04);
  });

  it('returns null when no match', () => {
    const lines = ['no keyword here', 'SAR 100.00'];
    expect(findAmountNearKeyword(lines, /ضريبة/iu)).toBeNull();
  });
});

// ─── findAmountByKeywords ─────────────────────────────────────────────
describe('findAmountByKeywords', () => {
  it('finds subtotal with merged-line keyword', () => {
    const lines = ['المجموع', 'الفرعي', 'SAR 86.96'];
    expect(findAmountByKeywords(lines, [/المجموع\s*الفرعي/iu])).toBe(86.96);
  });

  it('prefers last candidate with preferLast', () => {
    const lines = ['الإجمالي SAR 43.47', 'Subtotal', 'الإجمالي SAR 100.00'];
    expect(
      findAmountByKeywords(lines, [/الإجمالي/iu], { preferLast: true }),
    ).toBe(100);
  });
});

// ─── normalizeDate ────────────────────────────────────────────────────
describe('normalizeDate', () => {
  it('parses YYYY/MM/DD', () => {
    expect(normalizeDate('2021/11/14')).toBe('2021-11-14');
  });

  it('parses DD/MM/YYYY', () => {
    expect(normalizeDate('14/11/2021')).toBe('2021-11-14');
  });

  it('parses compact YYYYMMDD', () => {
    expect(normalizeDate('20231212')).toBe('2023-12-12');
  });

  it('returns null for invalid', () => {
    expect(normalizeDate('hello')).toBeNull();
  });
});

// ─── Receipt 1: header extraction ────────────────────────────────────
describe('Receipt 1 — header', () => {
  const header = extractHeader(RECEIPT_1_RAW);

  it('extracts invoice number 101347', () => {
    expect(header.invoiceNumber).toBe('101347');
  });

  it('extracts subtotal 86.96', () => {
    expect(header.subtotal).toBe(86.96);
  });

  it('extracts VAT amount 13.04', () => {
    expect(header.vatAmount).toBe(13.04);
  });

  it('extracts total 100.00', () => {
    expect(header.total).toBe(100);
  });

  it('extracts supplier VAT number', () => {
    expect(header.supplierVatNumber).toBe('310227420600003');
  });

  it('extracts invoice date as 2021-11-14', () => {
    expect(header.invoiceDate).toBe('2021-11-14');
  });

  it('currency is SAR', () => {
    expect(header.currency).toBe('SAR');
  });
});

// ─── Receipt 1: line items ───────────────────────────────────────────
describe('Receipt 1 — line items', () => {
  const items = extractLineItemsFromText(RECEIPT_1_LINES);

  it('extracts 6 items', () => {
    expect(items).toHaveLength(6);
  });

  it('item totals sum to 86.96', () => {
    const sum = items.reduce((s, i) => s + i.lineTotal, 0);
    expect(Math.abs(sum - 86.96)).toBeLessThan(0.01);
  });

  it('all quantities are 1', () => {
    items.forEach((i) => expect(i.quantity).toBe(1));
  });

  it('no item name is empty', () => {
    items.forEach((i) => expect(i.rawName.length).toBeGreaterThan(0));
  });
});

// ─── Receipt 2: header extraction ────────────────────────────────────
describe('Receipt 2 — header', () => {
  const header = extractHeader(RECEIPT_2_RAW);

  it('extracts invoice number 232130', () => {
    expect(header.invoiceNumber).toBe('232130');
  });

  it('extracts subtotal 43.47', () => {
    expect(header.subtotal).toBe(43.47);
  });

  it('extracts VAT amount 6.52', () => {
    expect(header.vatAmount).toBe(6.52);
  });

  it('extracts total 50.00', () => {
    expect(header.total).toBe(50);
  });

  it('extracts supplier VAT number', () => {
    expect(header.supplierVatNumber).toBe('302281309900003');
  });

  it('currency is SAR', () => {
    expect(header.currency).toBe('SAR');
  });
});

// ─── Receipt 2: line items ───────────────────────────────────────────
describe('Receipt 2 — line items', () => {
  const items = extractLineItemsFromText(RECEIPT_2_LINES);

  it('extracts 3 items', () => {
    expect(items).toHaveLength(3);
  });

  it('item totals sum to 43.47', () => {
    const sum = items.reduce((s, i) => s + i.lineTotal, 0);
    expect(Math.abs(sum - 43.47)).toBeLessThan(0.01);
  });

  it('third item name contains dates cake product', () => {
    expect(items[2].rawName.toLowerCase()).toContain('dates cake');
  });
});

// ─── TC2: noisy OCR footer block ─────────────────────────────────────
describe('TC2 — noisy OCR footer extraction', () => {
  const NOISY_LINES = [
    'المجموع الفرعي',
    'SAR 43.47',
    'Subtotal',
    'SAR 6.52',
    '١ضريبة القيمة المضافة',
    'التقريب',
    'SAR 0.01',
    'الإجمالي',
    'SAR 50.00',
  ];
  const header = extractHeader(NOISY_LINES.join('\n'));

  it('subtotal = 43.47 (Arabic keyword wins)', () => {
    expect(header.subtotal).toBe(43.47);
  });

  it('vatAmount = 6.52', () => {
    expect(header.vatAmount).toBe(6.52);
  });

  it('total = 50.00', () => {
    expect(header.total).toBe(50);
  });

  it('footer lines produce zero line items', () => {
    const items = extractLineItemsFromText(NOISY_LINES);
    expect(items).toHaveLength(0);
  });
});

// ─── TC3: footer protection ───────────────────────────────────────────
describe('TC3 — footer lines never become products', () => {
  const FOOTER_LINES = [
    'المجموع الفرعي SAR 43.47',
    'Subtotal',
    'ضريبة القيمة المضافة SAR 6.52',
    'التقريب SAR 0.01',
    'Rounding',
    'الإجمالي SAR 50.00',
    'Total',
    'الدفع SAR 50.00',
    'الرقم الضريبي 310227420600003',
  ];

  it('no footer line becomes a product', () => {
    const items = extractLineItemsFromText(FOOTER_LINES);
    expect(items).toHaveLength(0);
  });
});

// ─── TC4: extractDateFromDigitRuns ────────────────────────────────────
describe('TC4 — extractDateFromDigitRuns', () => {
  it('recovers date from trailing digit run: 041502320231212 → 2023-12-12', () => {
    expect(extractDateFromDigitRuns('041502320231212')).toBe('2023-12-12');
  });

  it('recovers date from exact 8-digit run: 20231212 → 2023-12-12', () => {
    expect(extractDateFromDigitRuns('20231212')).toBe('2023-12-12');
  });

  it('returns null for non-date digit runs', () => {
    expect(extractDateFromDigitRuns('310227420600003')).toBeNull();
  });
});

// ─── findAmountNearKeywordStrict ──────────────────────────────────────
describe('findAmountNearKeywordStrict', () => {
  it('finds Arabic subtotal, skips English subtotal with excluded line', () => {
    const lines = [
      'المجموع الفرعي',
      'SAR 43.47',
      'Subtotal',
      'SAR 6.52',
    ];
    const result = findAmountNearKeywordStrict(
      lines,
      /المجموع\s*الفرعي|subtotal/iu,
      { preferArabicLabel: true, exclude: [/ضريبة|vat/iu] },
    );
    expect(result).toBe(43.47);
  });

  it('stops at excluded line (boundary behavior)', () => {
    const lines = [
      'الإجمالي',
      'ضريبة',
      'SAR 50.00',
    ];
    const result = findAmountNearKeywordStrict(
      lines,
      /الإجمالي/iu,
      { windowAfter: 3, exclude: [/ضريبة/iu] },
    );
    // ضريبة is a stop boundary, SAR 50.00 should NOT be found forward
    expect(result).toBeNull();
  });

  it('finds amount on backward window past keyword', () => {
    const lines = [
      'SAR 50.00',
      'الإجمالي',
    ];
    const result = findAmountNearKeywordStrict(
      lines,
      /الإجمالي/iu,
      { windowBefore: 1 },
    );
    expect(result).toBe(50);
  });
});

// ─── Regression: subtotal must be 43.47, NOT 21.74 ──────────────────
describe('Regression — Receipt 2 subtotal correctness', () => {
  const header = extractHeader(RECEIPT_2_RAW);
  const items = extractLineItemsFromText(RECEIPT_2_LINES);

  it('subtotal is 43.47 not 21.74', () => {
    expect(header.subtotal).toBe(43.47);
    expect(header.subtotal).not.toBe(21.74);
  });

  it('VAT is 6.52', () => {
    expect(header.vatAmount).toBe(6.52);
  });

  it('total is 50.00', () => {
    expect(header.total).toBe(50);
  });

  it('exactly 3 line items (no footer lines as products)', () => {
    expect(items).toHaveLength(3);
  });

  it('no line item rawName matches footer keywords', () => {
    const FOOTER_RE =
      /(?:المجموع|الفرعي|Subtotal|ضريبة|VAT|الإجمالي|Total|التقريب|Rounding|الدفع|payment|الرقم\s*الضريبي)/iu;
    for (const item of items) {
      expect(item.rawName).not.toMatch(FOOTER_RE);
    }
  });

  it('line item totals sum matches subtotal', () => {
    const sum = items.reduce((s, i) => s + i.lineTotal, 0);
    expect(Math.abs(sum - 43.47)).toBeLessThan(0.02);
  });
});

// ─── Regression: mixed footer+product stream ────────────────────────
describe('Regression — products followed by footer must not leak', () => {
  const MIXED_LINES = [
    'الكمية وحدة السعر',
    '1 coffee day قهوه اليوم SAR 7.82',
    '1 Flat wight فلات وايت - SAR 13.91',
    '1 Dates cake.. كيكة التمر الايس كريم SAR 21.74',
    'with ice cream',
    'المجموع الفرعي SAR 43.47',
    'Subtotal',
    'ضريبة القيمة المضافة SAR 6.52',
    'التقريب SAR 0.01',
    'Rounding',
    'الإجمالي SAR 50.00',
    'Total',
    'الدفع - شبكة card SAR 50.00',
    'الرقم الضريبي 310227420600003',
  ];

  const items = extractLineItemsFromText(MIXED_LINES);

  it('extracts exactly 3 products', () => {
    expect(items).toHaveLength(3);
  });

  it('first product is coffee day', () => {
    expect(items[0].rawName.toLowerCase()).toContain('coffee day');
    expect(items[0].lineTotal).toBe(7.82);
  });

  it('second product is Flat wight', () => {
    expect(items[1].rawName.toLowerCase()).toContain('flat wight');
    expect(items[1].lineTotal).toBe(13.91);
  });

  it('third product is Dates cake', () => {
    expect(items[2].rawName.toLowerCase()).toContain('dates cake');
    expect(items[2].lineTotal).toBe(21.74);
  });

  it('no footer amount appears as a line item total', () => {
    const footerAmounts = [43.47, 6.52, 0.01, 50.0];
    for (const item of items) {
      expect(footerAmounts).not.toContain(item.lineTotal);
    }
  });
});
