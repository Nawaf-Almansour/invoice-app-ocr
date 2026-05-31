import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { InvoiceOcrService } from './invoice-ocr.service';

interface OcrJobData {
  invoiceUploadId: string;
  filePath: string;
  mode: string;
}

@Processor('invoice-ocr')
export class InvoiceOcrProcessor extends WorkerHost {
  private readonly logger = new Logger(InvoiceOcrProcessor.name);

  constructor(private readonly ocrService: InvoiceOcrService) {
    super();
  }

  async process(job: Job<OcrJobData>): Promise<void> {
    const { invoiceUploadId, filePath, mode } = job.data;
    this.logger.log(
      `Processing OCR job ${job.id} for upload ${invoiceUploadId}`,
    );
    await this.ocrService.processOcrJob(invoiceUploadId, filePath, mode);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<OcrJobData>, error: Error) {
    this.logger.error(
      `OCR job ${job.id} failed after ${job.attemptsMade} attempts: ${error.message}`,
    );
    if (job.attemptsMade >= (job.opts?.attempts ?? 3)) {
      this.logger.error(
        `OCR job ${job.id} exhausted all retries (dead-letter). Upload: ${job.data.invoiceUploadId}`,
      );
    }
  }
}
