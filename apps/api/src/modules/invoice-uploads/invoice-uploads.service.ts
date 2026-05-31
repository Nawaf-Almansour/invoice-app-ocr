import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as fs from 'fs';
import * as path from 'path';
import { InvoiceUpload } from './entities/invoice-upload.entity';
import { InvoiceStatus } from '../../common/enums/invoice-status.enum';
import { ConfigService } from '@nestjs/config';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];

@Injectable()
export class InvoiceUploadsService {
  constructor(
    @InjectRepository(InvoiceUpload)
    private readonly repo: Repository<InvoiceUpload>,
    @InjectQueue('invoice-ocr')
    private readonly ocrQueue: Queue,
    private readonly config: ConfigService,
  ) {}

  async uploadInvoice(
    file: Express.Multer.File,
    uploadedBy?: string,
  ): Promise<InvoiceUpload> {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type: ${file.mimetype}. Allowed: jpeg, png, pdf`,
      );
    }

    const maxMb = this.config.get<number>('MAX_UPLOAD_SIZE_MB', 20);
    if (file.size > maxMb * 1024 * 1024) {
      throw new BadRequestException(`File exceeds ${maxMb}MB limit`);
    }

    const uploadDir = this.config.get<string>('UPLOAD_DIR', './uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.pdf'];
    if (!allowedExtensions.includes(ext)) {
      throw new BadRequestException(
        `Invalid file extension: ${ext}. Allowed: ${allowedExtensions.join(', ')}`,
      );
    }

    const sanitizedBase = Math.random().toString(36).slice(2);
    const fileName = `${Date.now()}-${sanitizedBase}${ext}`;

    if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
      throw new BadRequestException('Invalid file name');
    }

    const filePath = path.resolve(uploadDir, fileName);
    const resolvedUploadDir = path.resolve(uploadDir);
    if (!filePath.startsWith(resolvedUploadDir + path.sep)) {
      throw new BadRequestException('Path traversal detected');
    }

    fs.writeFileSync(filePath, file.buffer);

    const record = this.repo.create({
      fileUrl: `/uploads/${fileName}`,
      originalFileName: file.originalname,
      mimeType: file.mimetype,
      status: InvoiceStatus.QUEUED,
      uploadedBy,
    });
    const saved = await this.repo.save(record);

    await this.ocrQueue.add(
      'process-ocr',
      {
        invoiceUploadId: saved.id,
        filePath,
        mode: 'hybrid',
      },
      {
        jobId: `ocr:${saved.id}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { age: 86400 },
        removeOnFail: { age: 604800 },
      },
    );

    return saved;
  }

  async findAll(): Promise<InvoiceUpload[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<InvoiceUpload> {
    const record = await this.repo.findOne({ where: { id } });
    if (!record) throw new NotFoundException(`Invoice ${id} not found`);
    return record;
  }

  async getStatus(id: string): Promise<{ id: string; status: InvoiceStatus }> {
    const record = await this.findOne(id);
    return { id: record.id, status: record.status };
  }

  async remove(id: string): Promise<void> {
    const record = await this.findOne(id);
    await this.repo.remove(record);
  }

  async updateStatus(
    id: string,
    status: InvoiceStatus,
    errorMessage?: string,
  ): Promise<void> {
    await this.repo.update(id, {
      status,
      ...(errorMessage && { errorMessage }),
    });
  }
}
