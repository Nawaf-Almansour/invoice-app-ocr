import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvoiceExtraction } from './entities/invoice-extraction.entity';
import { InvoiceExtractionLine } from './entities/invoice-extraction-line.entity';
import { InvoiceExtractionService } from './invoice-extraction.service';
import { InvoiceUploadsModule } from '../invoice-uploads/invoice-uploads.module';
import { InvoiceValidationModule } from '../invoice-validation/invoice-validation.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([InvoiceExtraction, InvoiceExtractionLine]),
    InvoiceUploadsModule,
    InvoiceValidationModule,
  ],
  providers: [InvoiceExtractionService],
  exports: [InvoiceExtractionService],
})
export class InvoiceExtractionModule {}
