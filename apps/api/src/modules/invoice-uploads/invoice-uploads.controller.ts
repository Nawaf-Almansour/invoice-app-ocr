import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UploadedFile,
  UseInterceptors,
  Body,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InvoiceUploadsService } from './invoice-uploads.service';
import { UploadInvoiceDto } from './dto/upload-invoice.dto';

@Controller('invoices')
export class InvoiceUploadsController {
  constructor(private readonly service: InvoiceUploadsService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { storage: undefined }))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadInvoiceDto,
  ) {
    const record = await this.service.uploadInvoice(file, dto.uploadedBy);
    return {
      id: record.id,
      status: record.status,
      message: 'Invoice uploaded and queued for OCR',
      fileUrl: record.fileUrl,
    };
  }

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Get(':id/status')
  getStatus(@Param('id') id: string) {
    return this.service.getStatus(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
