import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PurchaseInvoice } from './entities/purchase-invoice.entity';
import { PurchaseInvoiceLine } from './entities/purchase-invoice-line.entity';
import { PurchaseInvoicesService } from './purchase-invoices.service';
import { InvoiceUploadsModule } from '../invoice-uploads/invoice-uploads.module';
import { AuditLogModule } from '../audit-log/audit-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PurchaseInvoice, PurchaseInvoiceLine]),
    InvoiceUploadsModule,
    AuditLogModule,
  ],
  providers: [PurchaseInvoicesService],
  exports: [PurchaseInvoicesService],
})
export class PurchaseInvoicesModule {}
