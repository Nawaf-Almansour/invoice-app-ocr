import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InvoiceOcrResult } from './entities/invoice-ocr-result.entity';
import { OcrWorkerClient } from './clients/ocr-worker.client';
import { InvoiceUploadsService } from '../invoice-uploads/invoice-uploads.service';
import { InvoiceExtractionService } from '../invoice-extraction/invoice-extraction.service';
import { InvoiceStatus } from '../../common/enums/invoice-status.enum';

@Injectable()
export class InvoiceOcrService {
  private readonly logger = new Logger(InvoiceOcrService.name);

  constructor(
    @InjectRepository(InvoiceOcrResult)
    private readonly ocrResultRepo: Repository<InvoiceOcrResult>,
    private readonly ocrWorkerClient: OcrWorkerClient,
    private readonly uploadsService: InvoiceUploadsService,
    private readonly extractionService: InvoiceExtractionService,
  ) {}

  async processOcrJob(
    invoiceUploadId: string,
    filePath: string,
    mode: string,
  ): Promise<void> {
    try {
      await this.uploadsService.updateStatus(
        invoiceUploadId,
        InvoiceStatus.PROCESSING_OCR,
      );

      const result = await this.ocrWorkerClient.scan({
        invoiceUploadId,
        filePath,
        mode: mode as 'hybrid' | 'ppocrv5' | 'vl',
        languageHints: ['ar', 'en'],
      });

      const ocrRecord = this.ocrResultRepo.create({
        invoiceUploadId,
        engine: result.engine,
        rawText: result.rawText,
        ocrJson: { lines: result.lines, documentJson: result.documentJson },
        markdown: result.markdown,
        confidence: result.confidence,
        usedEnhancedFallback: result.usedEnhancedFallback,
      });
      await this.ocrResultRepo.save(ocrRecord);

      await this.uploadsService.updateStatus(
        invoiceUploadId,
        InvoiceStatus.OCR_COMPLETED,
      );

      await this.extractionService.extractFromOcr(invoiceUploadId, result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`OCR failed for ${invoiceUploadId}: ${message}`);
      await this.uploadsService.updateStatus(
        invoiceUploadId,
        InvoiceStatus.OCR_FAILED,
        message,
      );
    }
  }

  async getOcrResult(invoiceUploadId: string): Promise<InvoiceOcrResult | null> {
    return this.ocrResultRepo.findOne({ where: { invoiceUploadId } });
  }
}
