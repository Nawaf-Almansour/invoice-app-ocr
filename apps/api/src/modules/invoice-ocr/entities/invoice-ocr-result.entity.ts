import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { InvoiceUpload } from '../../invoice-uploads/entities/invoice-upload.entity';

@Entity('invoice_ocr_results')
export class InvoiceOcrResult {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => InvoiceUpload)
  @JoinColumn({ name: 'invoice_upload_id' })
  invoiceUpload: InvoiceUpload;

  @Column({ name: 'invoice_upload_id', type: 'uuid' })
  invoiceUploadId: string;

  @Column({ length: 50 })
  engine: string;

  @Column({ name: 'raw_text', type: 'text', nullable: true })
  rawText: string;

  @Column({ name: 'ocr_json', type: 'jsonb', nullable: true })
  ocrJson: Record<string, unknown>;

  @Column({ type: 'text', nullable: true })
  markdown: string;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  confidence: number;

  @Column({ name: 'used_enhanced_fallback', default: false })
  usedEnhancedFallback: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
