import { Module } from '@nestjs/common';
import { InvoiceReviewService } from './invoice-review.service';
import { InvoiceReviewController } from './invoice-review.controller';
import { InvoiceExtractionModule } from '../invoice-extraction/invoice-extraction.module';
import { InvoiceValidationModule } from '../invoice-validation/invoice-validation.module';
import { InvoiceUploadsModule } from '../invoice-uploads/invoice-uploads.module';
import { PurchaseInvoicesModule } from '../purchase-invoices/purchase-invoices.module';
import { InventoryPostingModule } from '../inventory-posting/inventory-posting.module';
import { AccountingPostingModule } from '../accounting-posting/accounting-posting.module';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [
    InvoiceExtractionModule,
    InvoiceValidationModule,
    InvoiceUploadsModule,
    PurchaseInvoicesModule,
    InventoryPostingModule,
    AccountingPostingModule,
    AuditLogModule,
  ],
  controllers: [InvoiceReviewController],
  providers: [InvoiceReviewService],
})
export class InvoiceReviewModule {}
