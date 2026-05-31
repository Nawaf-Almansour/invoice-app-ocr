import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { InvoiceUpload } from './entities/invoice-upload.entity';
import { InvoiceUploadsService } from './invoice-uploads.service';
import { InvoiceUploadsController } from './invoice-uploads.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([InvoiceUpload]),
    BullModule.registerQueue({ name: 'invoice-ocr' }),
  ],
  controllers: [InvoiceUploadsController],
  providers: [InvoiceUploadsService],
  exports: [InvoiceUploadsService],
})
export class InvoiceUploadsModule {}
