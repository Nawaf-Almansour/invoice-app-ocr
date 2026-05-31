import { Controller, Get, Post, Patch, Body, Query, Param } from '@nestjs/common';
import { ProductMappingService } from './product-mapping.service';
import { InvoiceExtractionService } from '../invoice-extraction/invoice-extraction.service';

@Controller('product-mappings')
export class ProductMappingController {
  constructor(
    private readonly mappingService: ProductMappingService,
    private readonly extractionService: InvoiceExtractionService,
  ) {}

  @Get('suggestions')
  async getSuggestions(
    @Query('rawName') rawName: string,
    @Query('supplierId') supplierId?: string,
  ) {
    return this.mappingService.getSuggestions(rawName, supplierId);
  }

  @Post()
  async createMapping(
    @Body()
    body: {
      supplierId?: string;
      rawVendorItemName: string;
      productId: string;
      sourceUnit?: string;
      targetUnit?: string;
    },
  ) {
    return this.mappingService.saveMapping(body);
  }

  @Patch('invoice-lines/:lineId/mapping')
  async mapLine(
    @Param('lineId') lineId: string,
    @Body() body: { productId: string },
  ) {
    await this.extractionService.updateLine(lineId, { productId: body.productId });
    return { success: true };
  }
}
