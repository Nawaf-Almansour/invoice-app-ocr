import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JournalEntry } from './entities/journal-entry.entity';
import { JournalEntryLine } from './entities/journal-entry-line.entity';
import { AccountingPostingService } from './accounting-posting.service';

@Module({
  imports: [TypeOrmModule.forFeature([JournalEntry, JournalEntryLine])],
  providers: [AccountingPostingService],
  exports: [AccountingPostingService],
})
export class AccountingPostingModule {}
