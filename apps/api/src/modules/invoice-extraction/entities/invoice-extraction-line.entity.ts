import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { InvoiceExtraction } from './invoice-extraction.entity';

@Entity('invoice_extraction_lines')
export class InvoiceExtractionLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => InvoiceExtraction, (e) => e.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'invoice_extraction_id' })
  extraction: InvoiceExtraction;

  @Column({ name: 'invoice_extraction_id', type: 'uuid' })
  invoiceExtractionId: string;

  @Column({ name: 'raw_name', type: 'text' })
  rawName: string;

  @Column({ name: 'suggested_product_id', type: 'uuid', nullable: true })
  suggestedProductId: string;

  @Column({ name: 'product_id', type: 'uuid', nullable: true })
  productId: string;

  @Column({ type: 'numeric', precision: 12, scale: 3, nullable: true })
  quantity: number;

  @Column({ length: 50, nullable: true })
  unit: string;

  @Column({ name: 'unit_price', type: 'numeric', precision: 12, scale: 2, nullable: true })
  unitPrice: number;

  @Column({ name: 'line_total', type: 'numeric', precision: 12, scale: 2, nullable: true })
  lineTotal: number;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  confidence: number;

  @Column({ name: 'needs_review', default: true })
  needsReview: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
