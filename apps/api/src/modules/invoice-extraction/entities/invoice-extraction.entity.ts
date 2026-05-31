import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { InvoiceExtractionLine } from './invoice-extraction-line.entity';

@Entity('invoice_extractions')
export class InvoiceExtraction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'invoice_upload_id', type: 'uuid' })
  invoiceUploadId: string;

  @Column({ name: 'supplier_id', type: 'uuid', nullable: true })
  supplierId: string;

  @Column({ name: 'supplier_name', type: 'text', nullable: true })
  supplierName: string;

  @Column({ name: 'supplier_vat_number', length: 30, nullable: true })
  supplierVatNumber: string;

  @Column({ name: 'invoice_number', length: 100, nullable: true })
  invoiceNumber: string;

  @Column({ name: 'invoice_date', type: 'date', nullable: true })
  invoiceDate: string;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate: string;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  subtotal: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  discount: number;

  @Column({ name: 'vat_amount', type: 'numeric', precision: 12, scale: 2, nullable: true })
  vatAmount: number;

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  total: number;

  @Column({ length: 10, default: 'SAR' })
  currency: string;

  @Column({ name: 'extracted_json', type: 'jsonb', nullable: true })
  extractedJson: Record<string, unknown>;

  @Column({ name: 'validation_json', type: 'jsonb', nullable: true })
  validationJson: Record<string, unknown>;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  confidence: number;

  @Column({ name: 'needs_review', default: true })
  needsReview: boolean;

  @OneToMany(() => InvoiceExtractionLine, (line) => line.extraction, { cascade: true })
  lines: InvoiceExtractionLine[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
