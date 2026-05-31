import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InvoiceExtractionService } from '../invoice-extraction/invoice-extraction.service';
import { InvoiceValidationService } from '../invoice-validation/invoice-validation.service';
import { PurchaseInvoicesService } from '../purchase-invoices/purchase-invoices.service';
import { InventoryPostingService } from '../inventory-posting/inventory-posting.service';
import { AccountingPostingService } from '../accounting-posting/accounting-posting.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { InvoiceUploadsService } from '../invoice-uploads/invoice-uploads.service';
import { InvoiceStatus } from '../../common/enums/invoice-status.enum';
import { InvoiceExtraction } from '../invoice-extraction/entities/invoice-extraction.entity';
import { ReviewUpdateDto } from './dto/review-update.dto';

export { ReviewUpdateDto };

@Injectable()
export class InvoiceReviewService {
  constructor(
    private readonly extractionService: InvoiceExtractionService,
    private readonly validationService: InvoiceValidationService,
    private readonly purchaseInvoicesService: PurchaseInvoicesService,
    private readonly inventoryPostingService: InventoryPostingService,
    private readonly accountingPostingService: AccountingPostingService,
    private readonly auditLog: AuditLogService,
    private readonly uploadsService: InvoiceUploadsService,
  ) {}

  async getReviewData(invoiceUploadId: string) {
    const extraction = await this.extractionService.findByUploadId(invoiceUploadId);
    if (!extraction) throw new NotFoundException('Extraction not found');

    const upload = await this.uploadsService.findOne(invoiceUploadId);
    const validation = await this.validationService.validate(extraction, extraction.lines ?? []);

    return {
      extraction,
      validation,
      fileUrl: upload.fileUrl,
      mimeType: upload.mimeType,
      uploadStatus: upload.status,
    };
  }

  async updateExtraction(
    invoiceUploadId: string,
    dto: ReviewUpdateDto,
    userId?: string,
  ): Promise<InvoiceExtraction> {
    const extraction = await this.extractionService.findByUploadId(invoiceUploadId);
    if (!extraction) throw new NotFoundException('Extraction not found');

    const headerUpdates: Record<string, unknown> = {};
    if (dto.supplierName !== undefined) headerUpdates['supplierName'] = dto.supplierName;
    if (dto.supplierVatNumber !== undefined) headerUpdates['supplierVatNumber'] = dto.supplierVatNumber;
    if (dto.invoiceNumber !== undefined) headerUpdates['invoiceNumber'] = dto.invoiceNumber;
    if (dto.invoiceDate !== undefined) headerUpdates['invoiceDate'] = dto.invoiceDate;
    if (dto.subtotal !== undefined) headerUpdates['subtotal'] = dto.subtotal;
    if (dto.vatAmount !== undefined) headerUpdates['vatAmount'] = dto.vatAmount;
    if (dto.total !== undefined) headerUpdates['total'] = dto.total;
    if (dto.currency !== undefined) headerUpdates['currency'] = dto.currency;

    if (Object.keys(headerUpdates).length > 0) {
      await this.extractionService.updateExtraction(extraction.id, headerUpdates);
    }

    if (dto.lines) {
      for (const lineUpdate of dto.lines) {
        const { id, ...rest } = lineUpdate;
        await this.extractionService.updateLine(id, rest as Record<string, unknown>);
      }
    }

    await this.auditLog.log(
      'invoice_extraction',
      extraction.id,
      'MANUAL_REVIEW_UPDATE',
      undefined,
      dto as unknown as Record<string, unknown>,
      userId,
    );

    return (await this.extractionService.findByUploadId(invoiceUploadId))!;
  }

  async approve(
    invoiceUploadId: string,
    userId?: string,
  ) {
    const extraction = await this.extractionService.findByUploadId(invoiceUploadId);
    if (!extraction) throw new NotFoundException('Extraction not found');

    const { errors } = await this.validationService.validateForApproval(
      extraction,
      extraction.lines ?? [],
    );

    if (errors.length > 0) {
      throw new BadRequestException(`Cannot approve: ${errors.join('; ')}`);
    }

    const purchaseInvoice = await this.purchaseInvoicesService.approve(
      extraction,
      extraction.lines ?? [],
      userId,
    );

    return {
      purchaseInvoice,
      status: InvoiceStatus.APPROVED,
    };
  }

  async postToInventory(invoiceUploadId: string, userId?: string) {
    const purchaseInvoice =
      await this.purchaseInvoicesService.findByUploadId(invoiceUploadId);
    if (!purchaseInvoice) {
      throw new NotFoundException('Purchase invoice not found — approve first');
    }

    const { errors: postErrors } = this.validationService.validateForPosting(
      purchaseInvoice.lines ?? [],
    );
    if (postErrors.length > 0) {
      throw new BadRequestException(`Cannot post: ${postErrors.join('; ')}`);
    }

    const movements = await this.inventoryPostingService.postToInventory(purchaseInvoice);

    await this.auditLog.log(
      'purchase_invoice',
      purchaseInvoice.id,
      'POSTED_TO_INVENTORY',
      undefined,
      { movementsCreated: movements.length } as Record<string, unknown>,
      userId,
    );

    return { movements, status: InvoiceStatus.POSTED_TO_INVENTORY };
  }

  async postToAccounting(invoiceUploadId: string, userId?: string) {
    const purchaseInvoice =
      await this.purchaseInvoicesService.findByUploadId(invoiceUploadId);
    if (!purchaseInvoice) {
      throw new NotFoundException('Purchase invoice not found — approve first');
    }

    const journalEntry =
      await this.accountingPostingService.postToAccounting(purchaseInvoice);

    await this.auditLog.log(
      'purchase_invoice',
      purchaseInvoice.id,
      'POSTED_TO_ACCOUNTING',
      undefined,
      { journalEntryId: journalEntry.id } as Record<string, unknown>,
      userId,
    );

    return { journalEntry, status: InvoiceStatus.POSTED_TO_ACCOUNTING };
  }

  async reject(invoiceUploadId: string, reason: string, userId?: string) {
    const extraction = await this.extractionService.findByUploadId(invoiceUploadId);
    if (!extraction) throw new NotFoundException('Extraction not found');

    await this.auditLog.log(
      'invoice_extraction',
      extraction.id,
      'REJECTED',
      undefined,
      { reason } as Record<string, unknown>,
      userId,
    );

    return { success: true };
  }
}
