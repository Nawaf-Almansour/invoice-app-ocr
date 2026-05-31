import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InvoiceExtraction } from './entities/invoice-extraction.entity';
import { InvoiceExtractionLine } from './entities/invoice-extraction-line.entity';
import { InvoiceUploadsService } from '../invoice-uploads/invoice-uploads.service';
import { InvoiceValidationService } from '../invoice-validation/invoice-validation.service';
import { extractHeader } from './extractors/invoice-header.extractor';
import { extractLineItemsFromOcr } from './extractors/ocr-row-grouping.extractor';
import { extractLineItemsFromText } from './extractors/line-item-text.extractor';
import { InvoiceStatus } from '../../common/enums/invoice-status.enum';
import type { OcrWorkerResponse } from '../invoice-ocr/clients/ocr-worker.client';

@Injectable()
export class InvoiceExtractionService {
  private readonly logger = new Logger(InvoiceExtractionService.name);

  constructor(
    @InjectRepository(InvoiceExtraction)
    private readonly extractionRepo: Repository<InvoiceExtraction>,
    @InjectRepository(InvoiceExtractionLine)
    private readonly lineRepo: Repository<InvoiceExtractionLine>,
    private readonly uploadsService: InvoiceUploadsService,
    private readonly validationService: InvoiceValidationService,
  ) {}

  async extractFromOcr(
    invoiceUploadId: string,
    ocrResult: OcrWorkerResponse,
  ): Promise<InvoiceExtraction> {
    await this.uploadsService.updateStatus(
      invoiceUploadId,
      InvoiceStatus.EXTRACTING,
    );

    try {
      const header = extractHeader(ocrResult.rawText);

      // Text-based extraction is the primary approach (more accurate
      // with improved regex patterns). Fall back to OCR row-grouping
      // only when the text-based extractor finds nothing.
      let lineItems: {
        rawName: string;
        quantity: number;
        unitPrice?: number;
        unit?: string;
        lineTotal: number;
        confidence: number;
        needsReview: boolean;
      }[] = [];

      if (ocrResult.rawText) {
        const rawLines = ocrResult.rawText.split('\n');
        const textItems = extractLineItemsFromText(rawLines);
        lineItems = textItems.map((ti) => ({
          rawName: ti.rawName,
          quantity: ti.quantity,
          unitPrice: ti.unitPrice,
          lineTotal: ti.lineTotal,
          confidence: ti.confidence,
          needsReview: ti.needsReview,
        }));
      }

      if (lineItems.length === 0) {
        lineItems = extractLineItemsFromOcr(ocrResult.lines).map((li) => ({
          rawName: li.rawName,
          quantity: li.quantity ?? 1,
          unitPrice: li.unitPrice,
          unit: li.unit,
          lineTotal: li.lineTotal ?? 0,
          confidence: li.confidence,
          needsReview: li.needsReview,
        }));
      }

      const extraction = this.extractionRepo.create({
        invoiceUploadId,
        supplierName: header.supplierName,
        supplierVatNumber: header.supplierVatNumber,
        invoiceNumber: header.invoiceNumber,
        invoiceDate: header.invoiceDate,
        subtotal: header.subtotal,
        vatAmount: header.vatAmount,
        total: header.total,
        currency: header.currency,
        confidence: header.confidence,
        extractedJson: { raw: ocrResult.rawText, header },
      });

      const saved = await this.extractionRepo.save(extraction);

      const lines = lineItems.map((item) =>
        this.lineRepo.create({
          invoiceExtractionId: saved.id,
          rawName: item.rawName,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
          confidence: item.confidence,
          needsReview: item.needsReview,
        }),
      );
      if (lines.length > 0) await this.lineRepo.save(lines);

      await this.uploadsService.updateStatus(
        invoiceUploadId,
        InvoiceStatus.VALIDATING,
      );

      const validation = await this.validationService.validate(saved, lines);

      const needsReview = validation.needsReview || !validation.isValid;
      const finalStatus = needsReview
        ? InvoiceStatus.NEEDS_REVIEW
        : InvoiceStatus.READY;

      await this.extractionRepo.update(saved.id, {
        validationJson: validation as unknown as Record<string, unknown>,
        needsReview,
      } as any); // eslint-disable-line @typescript-eslint/no-unsafe-argument

      await this.uploadsService.updateStatus(invoiceUploadId, finalStatus);

      return saved;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Extraction failed for ${invoiceUploadId}: ${message}`);
      await this.uploadsService.updateStatus(
        invoiceUploadId,
        InvoiceStatus.EXTRACTION_FAILED,
        message,
      );
      throw err;
    }
  }

  async findByUploadId(
    invoiceUploadId: string,
  ): Promise<InvoiceExtraction | null> {
    return this.extractionRepo.findOne({
      where: { invoiceUploadId },
      relations: ['lines'],
      order: { createdAt: 'DESC' },
    });
  }

  async updateExtraction(
    id: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    await this.extractionRepo.update(id, data);
  }

  async updateLine(
    lineId: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    await this.lineRepo.update(lineId, data);
  }
}
