import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { InventoryMovement } from './entities/inventory-movement.entity';
import { PurchaseInvoice } from '../purchase-invoices/entities/purchase-invoice.entity';
import { InvoiceUpload } from '../invoice-uploads/entities/invoice-upload.entity';
import { InvoiceStatus } from '../../common/enums/invoice-status.enum';

@Injectable()
export class InventoryPostingService {
  constructor(
    @InjectRepository(InventoryMovement)
    private readonly movementRepo: Repository<InventoryMovement>,
    private readonly dataSource: DataSource,
  ) {}

  async postToInventory(
    invoice: PurchaseInvoice,
  ): Promise<InventoryMovement[]> {
    if (!invoice.lines || invoice.lines.length === 0) {
      throw new BadRequestException('No lines to post to inventory');
    }

    for (const line of invoice.lines) {
      if (!line.productId) {
        throw new BadRequestException(
          `Line "${line.rawName}" has no product mapping`,
        );
      }
      if (!line.quantity || Number(line.quantity) <= 0) {
        throw new BadRequestException(
          `Line "${line.rawName}" has invalid quantity`,
        );
      }
      if (!line.lineTotal || Number(line.lineTotal) <= 0) {
        throw new BadRequestException(
          `Line "${line.rawName}" has invalid line total`,
        );
      }
    }

    return this.dataSource.transaction(async (manager) => {
      const movements = invoice.lines.map((line) =>
        manager.create(InventoryMovement, {
          purchaseInvoiceId: invoice.id,
          productId: line.productId,
          movementType: 'IN',
          quantity: line.quantity,
          unit: line.unit,
          unitCost: line.unitPrice,
          totalCost: line.lineTotal,
        }),
      );
      const saved = await manager.save(InventoryMovement, movements);

      await manager.update(
        InvoiceUpload,
        { id: invoice.invoiceUploadId },
        { status: InvoiceStatus.POSTED_TO_INVENTORY },
      );

      return saved;
    });
  }
}
