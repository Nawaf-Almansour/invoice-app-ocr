import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VendorItemMapping } from './entities/vendor-item-mapping.entity';
import { ProductMappingService } from './product-mapping.service';
import { ProductMappingController } from './product-mapping.controller';
import { InvoiceExtractionModule } from '../invoice-extraction/invoice-extraction.module';

@Module({
  imports: [TypeOrmModule.forFeature([VendorItemMapping]), InvoiceExtractionModule],
  controllers: [ProductMappingController],
  providers: [ProductMappingService],
  exports: [ProductMappingService],
})
export class ProductMappingModule {}
