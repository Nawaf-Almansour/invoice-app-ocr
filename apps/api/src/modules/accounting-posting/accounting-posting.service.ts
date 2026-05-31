import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { JournalEntry } from './entities/journal-entry.entity';
import { JournalEntryLine } from './entities/journal-entry-line.entity';
import { PurchaseInvoice } from '../purchase-invoices/entities/purchase-invoice.entity';
import { InvoiceUpload } from '../invoice-uploads/entities/invoice-upload.entity';
import { AuditLog } from '../audit-log/entities/audit-log.entity';
import { InvoiceStatus } from '../../common/enums/invoice-status.enum';

@Injectable()
export class AccountingPostingService {
  constructor(
    @InjectRepository(JournalEntry)
    private readonly entryRepo: Repository<JournalEntry>,
    @InjectRepository(JournalEntryLine)
    private readonly lineRepo: Repository<JournalEntryLine>,
    private readonly dataSource: DataSource,
  ) {}

  async postToAccounting(invoice: PurchaseInvoice): Promise<JournalEntry> {
    if (!invoice.invoiceDate) {
      throw new BadRequestException(
        'Invoice date is required for accounting posting',
      );
    }
    if (!invoice.invoiceNumber) {
      throw new BadRequestException(
        'Invoice number is required for accounting posting',
      );
    }
    if (!invoice.total || Number(invoice.total) <= 0) {
      throw new BadRequestException('Invalid total for accounting posting');
    }

    const total = Number(invoice.total);
    const vatAmount = Number(invoice.vatAmount ?? 0);
    const inventoryAmount = total - vatAmount;

    return this.dataSource.transaction(async (manager) => {
      const entry = manager.create(JournalEntry, {
        purchaseInvoiceId: invoice.id,
        date: invoice.invoiceDate,
        description: `Purchase invoice ${invoice.invoiceNumber}`,
        status: 'POSTED',
      });
      const je = await manager.save(JournalEntry, entry);

      const entryLines = [
        manager.create(JournalEntryLine, {
          journalEntryId: je.id,
          accountCode: '1200',
          accountName: 'Inventory / Purchases',
          side: 'DR',
          amount: inventoryAmount,
        }),
        manager.create(JournalEntryLine, {
          journalEntryId: je.id,
          accountCode: '2400',
          accountName: 'VAT Input',
          side: 'DR',
          amount: vatAmount,
        }),
        manager.create(JournalEntryLine, {
          journalEntryId: je.id,
          accountCode: '2100',
          accountName: 'Accounts Payable',
          side: 'CR',
          amount: total,
        }),
      ];
      await manager.save(JournalEntryLine, entryLines);

      await manager.update(
        InvoiceUpload,
        { id: invoice.invoiceUploadId },
        { status: InvoiceStatus.POSTED_TO_ACCOUNTING },
      );

      const auditEntry = manager.create(AuditLog, {
        entityType: 'purchase_invoice',
        entityId: invoice.id,
        action: 'POSTED_TO_ACCOUNTING',
        newValue: { journalEntryId: je.id },
      });
      await manager.save(AuditLog, auditEntry);

      return je;
    });
  }
}
