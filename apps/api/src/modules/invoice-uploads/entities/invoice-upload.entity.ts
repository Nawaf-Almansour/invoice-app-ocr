import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { InvoiceStatus } from '../../../common/enums/invoice-status.enum';

@Entity('invoice_uploads')
export class InvoiceUpload {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'file_url', type: 'text' })
  fileUrl: string;

  @Column({ name: 'original_file_name', type: 'text', nullable: true })
  originalFileName: string;

  @Column({ name: 'mime_type', length: 100, nullable: true })
  mimeType: string;

  @Column({ type: 'varchar', length: 50, default: InvoiceStatus.UPLOADED })
  status: InvoiceStatus;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string;

  @Column({ name: 'uploaded_by', type: 'uuid', nullable: true })
  uploadedBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
