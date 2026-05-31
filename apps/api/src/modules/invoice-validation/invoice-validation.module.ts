import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvoiceExtraction } from '../invoice-extraction/entities/invoice-extraction.entity';
import { InvoiceValidationService } from './invoice-validation.service';

@Module({
  imports: [TypeOrmModule.forFeature([InvoiceExtraction])],
  providers: [InvoiceValidationService],
  exports: [InvoiceValidationService],
})
export class InvoiceValidationModule {}
