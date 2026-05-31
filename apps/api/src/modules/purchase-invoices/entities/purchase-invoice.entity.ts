import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { PurchaseInvoiceLine } from './purchase-invoice-line.entity';

@Entity('purchase_invoices')
export class PurchaseInvoice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'invoice_upload_id', type: 'uuid' })
  invoiceUploadId: string;

  @Column({ name: 'supplier_id', type: 'uuid', nullable: true })
  supplierId: string;

  @Column({ name: 'supplier_name', type: 'text', nullable: true })
  supplierName: string;

  @Column({ name: 'invoice_number', length: 100 })
  invoiceNumber: string;

  @Column({ name: 'invoice_date', type: 'date' })
  invoiceDate: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  subtotal: number;

  @Column({ name: 'vat_amount', type: 'numeric', precision: 12, scale: 2, nullable: true })
  vatAmount: number;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  total: number;

  @Column({ length: 10, default: 'SAR' })
  currency: string;

  @Column({ length: 50, default: 'APPROVED' })
  status: string;

  @OneToMany(() => PurchaseInvoiceLine, (line) => line.invoice, { cascade: true })
  lines: PurchaseInvoiceLine[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
