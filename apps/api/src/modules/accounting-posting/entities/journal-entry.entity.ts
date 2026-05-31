import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { JournalEntryLine } from './journal-entry-line.entity';

@Entity('journal_entries')
export class JournalEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'purchase_invoice_id', type: 'uuid' })
  purchaseInvoiceId: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ length: 20, default: 'POSTED' })
  status: string;

  @OneToMany(() => JournalEntryLine, (l) => l.entry, { cascade: true })
  lines: JournalEntryLine[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
