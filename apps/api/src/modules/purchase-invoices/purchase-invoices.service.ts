import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PurchaseInvoice } from './entities/purchase-invoice.entity';
import { PurchaseInvoiceLine } from './entities/purchase-invoice-line.entity';
import { InvoiceExtraction } from '../invoice-extraction/entities/invoice-extraction.entity';
import { InvoiceExtractionLine } from '../invoice-extraction/entities/invoice-extraction-line.entity';
import { InvoiceUploadsService } from '../invoice-uploads/invoice-uploads.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { InvoiceStatus } from '../../common/enums/invoice-status.enum';

@Injectable()
export class PurchaseInvoicesService {
  constructor(
    @InjectRepository(PurchaseInvoice)
    private readonly invoiceRepo: Repository<PurchaseInvoice>,
    @InjectRepository(PurchaseInvoiceLine)
    private readonly lineRepo: Repository<PurchaseInvoiceLine>,
    private readonly uploadsService: InvoiceUploadsService,
    private readonly auditLog: AuditLogService,
    private readonly dataSource: DataSource,
  ) {}

  async approve(
    extraction: InvoiceExtraction,
    lines: InvoiceExtractionLine[],
    userId?: string,
  ): Promise<PurchaseInvoice> {
    const upload = await this.uploadsService.findOne(extraction.invoiceUploadId);

    const failedStatuses: InvoiceStatus[] = [
      InvoiceStatus.OCR_FAILED,
      InvoiceStatus.EXTRACTION_FAILED,
      InvoiceStatus.VALIDATION_FAILED,
    ];
    if (failedStatuses.includes(upload.status)) {
      throw new BadRequestException('Cannot approve a failed invoice');
    }

    if (!extraction.invoiceNumber) throw new BadRequestException('Invoice number is required');
    if (!extraction.total) throw new BadRequestException('Total amount is required');

    const existing = await this.invoiceRepo.findOne({
      where: { invoiceUploadId: extraction.invoiceUploadId },
    });
    if (existing) throw new ConflictException('Invoice already approved');

    const saved = await this.dataSource.transaction(async (manager) => {
      const invoice = manager.create(PurchaseInvoice, {
        invoiceUploadId: extraction.invoiceUploadId,
        supplierId: extraction.supplierId,
        supplierName: extraction.supplierName,
        invoiceNumber: extraction.invoiceNumber,
        invoiceDate: extraction.invoiceDate,
        subtotal: extraction.subtotal,
        vatAmount: extraction.vatAmount,
        total: extraction.total,
        currency: extraction.currency,
        status: 'APPROVED',
      });
      const savedInvoice = await manager.save(PurchaseInvoice, invoice);

      const purchaseLines = lines
        .filter((l) => l.productId)
        .map((l) =>
          manager.create(PurchaseInvoiceLine, {
            purchaseInvoiceId: savedInvoice.id,
            productId: l.productId,
            rawName: l.rawName,
            quantity: l.quantity ?? 1,
            unit: l.unit,
            unitPrice: l.unitPrice ?? 0,
            lineTotal: l.lineTotal ?? 0,
          }),
        );
      if (purchaseLines.length > 0) {
        await manager.save(PurchaseInvoiceLine, purchaseLines);
      }
      return savedInvoice;
    });

    await this.uploadsService.updateStatus(extraction.invoiceUploadId, InvoiceStatus.APPROVED);

    await this.auditLog.log(
      'purchase_invoice',
      saved.id,
      'APPROVED',
      undefined,
      { invoiceNumber: extraction.invoiceNumber, total: extraction.total } as Record<string, unknown>,
      userId,
    );

    return saved;
  }

  async findByUploadId(invoiceUploadId: string): Promise<PurchaseInvoice | null> {
    return this.invoiceRepo.findOne({
      where: { invoiceUploadId },
      relations: ['lines'],
    });
  }
}
