import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly repo: Repository<AuditLog>,
  ) {}

  async log(
    entityType: string,
    entityId: string,
    action: string,
    oldValue?: Record<string, unknown>,
    newValue?: Record<string, unknown>,
    userId?: string,
  ): Promise<void> {
    const entry = this.repo.create({
      entityType,
      entityId,
      action,
      oldValue,
      newValue,
      userId,
    });
    await this.repo.save(entry);
  }
}
