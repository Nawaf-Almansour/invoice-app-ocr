import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InvoiceExtraction } from '../invoice-extraction/entities/invoice-extraction.entity';
import { InvoiceExtractionLine } from '../invoice-extraction/entities/invoice-extraction-line.entity';

export interface InvoiceValidationResult {
  isValid: boolean;
  needsReview: boolean;
  warnings: string[];
  errors: string[];
  confidence: number;
}

@Injectable()
export class InvoiceValidationService {
  constructor(
    @InjectRepository(InvoiceExtraction)
    private readonly extractionRepo: Repository<InvoiceExtraction>,
  ) {}

  async validate(
    extraction: InvoiceExtraction,
    lines: InvoiceExtractionLine[],
  ): Promise<InvoiceValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const TOLERANCE = 0.1;

    // ── Required fields ──
    if (!extraction.invoiceNumber) errors.push('Invoice number is required');
    if (!extraction.invoiceDate) errors.push('Invoice date is required');
    if (!extraction.total) errors.push('Total amount is required');

    // ── VAT number validation ──
    if (extraction.supplierVatNumber) {
      if (!/^\d{15}$/.test(extraction.supplierVatNumber)) {
        warnings.push('Supplier VAT number should be 15 digits');
      }
    } else if ((extraction.currency ?? 'SAR') === 'SAR') {
      warnings.push('VAT number required for Saudi invoices');
    }

    // ── subtotal + vat = total ──
    if (extraction.subtotal && extraction.vatAmount && extraction.total) {
      const expected =
        Number(extraction.subtotal) + Number(extraction.vatAmount);
      const actual = Number(extraction.total);
      if (Math.abs(expected - actual) > TOLERANCE) {
        warnings.push(
          `Total mismatch: subtotal(${extraction.subtotal})` +
            ` + VAT(${extraction.vatAmount})` +
            ` = ${expected.toFixed(2)} but total is ${extraction.total}`,
        );
      }
    }

    // ── sum(items.lineTotal) ≈ subtotal ──
    if (lines.length > 0 && extraction.subtotal) {
      const itemsSum = lines.reduce(
        (sum, l) => sum + Number(l.lineTotal ?? 0),
        0,
      );
      const sub = Number(extraction.subtotal);
      if (Math.abs(itemsSum - sub) > TOLERANCE) {
        warnings.push(
          `Items sum(${itemsSum.toFixed(2)})` +
            ` ≠ subtotal(${sub.toFixed(2)})`,
        );
      }
    }

    // ── Line item qty × unitPrice = lineTotal ──
    for (const line of lines) {
      if (line.quantity && line.unitPrice && line.lineTotal) {
        const expected = Number(line.quantity) * Number(line.unitPrice);
        const actual = Number(line.lineTotal);
        if (Math.abs(expected - actual) > TOLERANCE) {
          warnings.push(`Line item "${line.rawName}" total mismatch`);
        }
      }
    }

    // ── Duplicate check ──
    const duplicate = await this.checkDuplicate(extraction);
    if (duplicate) {
      errors.push(
        `Duplicate invoice detected:` +
          ` ${extraction.supplierVatNumber} / ${extraction.invoiceNumber}`,
      );
    }

    // ── Unmapped lines ──
    const unmappedLines = lines.filter(
      (l) => !l.productId && !l.suggestedProductId,
    );
    if (unmappedLines.length > 0) {
      warnings.push(
        `${unmappedLines.length} line item(s) have no product mapping`,
      );
    }

    const isValid = errors.length === 0;
    const needsReview = !isValid || warnings.length > 0;
    const confidence = isValid ? (warnings.length === 0 ? 1.0 : 0.7) : 0.3;

    return { isValid, needsReview, warnings, errors, confidence };
  }

  /**
   * Hard validation for approval — blocks approve if any error is returned.
   * More strict than validate(): treats total mismatch as an error, not warning.
   */
  async validateForApproval(
    extraction: InvoiceExtraction,
    lines: InvoiceExtractionLine[],
  ): Promise<{ errors: string[] }> {
    const errors: string[] = [];
    const TOLERANCE = 0.1;

    if (!extraction.invoiceNumber) errors.push('Invoice number is required');
    if (!extraction.invoiceDate) errors.push('Invoice date is required');
    if (!extraction.total) errors.push('Total amount is required');

    if (extraction.subtotal && extraction.vatAmount && extraction.total) {
      const expected = Number(extraction.subtotal) + Number(extraction.vatAmount);
      const actual = Number(extraction.total);
      if (Math.abs(expected - actual) > TOLERANCE) {
        errors.push(
          `Total mismatch: ${extraction.subtotal} + ${extraction.vatAmount}` +
            ` = ${expected.toFixed(2)}, not ${extraction.total}`,
        );
      }
    }

    if (await this.checkDuplicate(extraction)) {
      errors.push(
        `Duplicate invoice: ${extraction.supplierVatNumber} / ${extraction.invoiceNumber}`,
      );
    }

    return { errors };
  }

  /**
   * Hard validation before inventory posting — all lines must be mapped.
   * Accepts any object with productId, quantity, lineTotal fields.
   */
  validateForPosting(
    lines: Array<{
      productId?: string | null;
      quantity?: number | null;
      lineTotal?: number | null;
    }>,
  ): { errors: string[] } {
    const errors: string[] = [];
    const unmapped = lines.filter((l) => !l.productId);
    if (unmapped.length > 0) {
      errors.push(`${unmapped.length} line(s) have no product mapping`);
    }
    const badQty = lines.filter((l) => !l.quantity || Number(l.quantity) <= 0);
    if (badQty.length > 0) {
      errors.push(`${badQty.length} line(s) have invalid quantity`);
    }
    const badTotal = lines.filter((l) => !l.lineTotal || Number(l.lineTotal) <= 0);
    if (badTotal.length > 0) {
      errors.push(`${badTotal.length} line(s) have invalid line total`);
    }
    return { errors };
  }

  private async checkDuplicate(
    extraction: InvoiceExtraction,
  ): Promise<boolean> {
    if (!extraction.supplierVatNumber || !extraction.invoiceNumber)
      return false;

    const existing = await this.extractionRepo
      .createQueryBuilder('e')
      .where('e.supplier_vat_number = :vat', {
        vat: extraction.supplierVatNumber,
      })
      .andWhere('e.invoice_number = :num', {
        num: extraction.invoiceNumber,
      })
      .andWhere('e.id != :id', { id: extraction.id || 'none' })
      .getOne();

    return !!existing;
  }
}
