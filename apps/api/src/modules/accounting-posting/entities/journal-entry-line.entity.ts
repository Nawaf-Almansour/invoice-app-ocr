import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { JournalEntry } from './journal-entry.entity';

@Entity('journal_entry_lines')
export class JournalEntryLine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => JournalEntry, (e) => e.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'journal_entry_id' })
  entry: JournalEntry;

  @Column({ name: 'journal_entry_id', type: 'uuid' })
  journalEntryId: string;

  @Column({ name: 'account_code', length: 50 })
  accountCode: string;

  @Column({ name: 'account_name', length: 255 })
  accountName: string;

  @Column({ type: 'varchar', length: 10 })
  side: 'DR' | 'CR';

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount: number;
}
