import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { HttpModule } from '@nestjs/axios';
import { InvoiceOcrResult } from './entities/invoice-ocr-result.entity';
import { InvoiceOcrService } from './invoice-ocr.service';
import { InvoiceOcrProcessor } from './invoice-ocr.processor';
import { OcrWorkerClient } from './clients/ocr-worker.client';
import { InvoiceUploadsModule } from '../invoice-uploads/invoice-uploads.module';
import { InvoiceExtractionModule } from '../invoice-extraction/invoice-extraction.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([InvoiceOcrResult]),
    BullModule.registerQueue({ name: 'invoice-ocr' }),
    HttpModule,
    InvoiceUploadsModule,
    InvoiceExtractionModule,
  ],
  providers: [InvoiceOcrService, InvoiceOcrProcessor, OcrWorkerClient],
  exports: [InvoiceOcrService],
})
export class InvoiceOcrModule {}
