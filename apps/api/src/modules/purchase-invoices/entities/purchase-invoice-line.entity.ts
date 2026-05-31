import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PurchaseInvoice } from './purchase-invoice.entity';

@Entity('purchase_invoice_lines')
export class PurchaseInvoiceLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => PurchaseInvoice, (inv) => inv.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'purchase_invoice_id' })
  invoice: PurchaseInvoice;

  @Column({ name: 'purchase_invoice_id', type: 'uuid' })
  purchaseInvoiceId: string;

  @Column({ name: 'product_id', type: 'uuid' })
  productId: string;

  @Column({ name: 'raw_name', type: 'text' })
  rawName: string;

  @Column({ type: 'numeric', precision: 12, scale: 3 })
  quantity: number;

  @Column({ length: 50, nullable: true })
  unit: string;

  @Column({ name: 'unit_price', type: 'numeric', precision: 12, scale: 2 })
  unitPrice: number;

  @Column({ name: 'line_total', type: 'numeric', precision: 12, scale: 2 })
  lineTotal: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
