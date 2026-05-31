import { IsOptional, IsString } from 'class-validator';

export class UploadInvoiceDto {
  @IsOptional()
  @IsString()
  uploadedBy?: string;
}
