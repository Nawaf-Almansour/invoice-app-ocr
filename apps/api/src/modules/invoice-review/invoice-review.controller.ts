import { Controller, Get, Patch, Post, Param, Body, Query } from '@nestjs/common';
import { InvoiceReviewService } from './invoice-review.service';
import { ReviewUpdateDto } from './dto/review-update.dto';

@Controller('invoice-review')
export class InvoiceReviewController {
  constructor(private readonly reviewService: InvoiceReviewService) {}

  @Get(':uploadId')
  getReview(@Param('uploadId') uploadId: string) {
    return this.reviewService.getReviewData(uploadId);
  }

  @Patch(':uploadId')
  updateReview(
    @Param('uploadId') uploadId: string,
    @Body() dto: ReviewUpdateDto,
    @Query('userId') userId?: string,
  ) {
    return this.reviewService.updateExtraction(uploadId, dto, userId);
  }

  @Post(':uploadId/approve')
  approve(
    @Param('uploadId') uploadId: string,
    @Query('userId') userId?: string,
  ) {
    return this.reviewService.approve(uploadId, userId);
  }

  @Post(':uploadId/post-to-inventory')
  postToInventory(
    @Param('uploadId') uploadId: string,
    @Query('userId') userId?: string,
  ) {
    return this.reviewService.postToInventory(uploadId, userId);
  }

  @Post(':uploadId/post-to-accounting')
  postToAccounting(
    @Param('uploadId') uploadId: string,
    @Query('userId') userId?: string,
  ) {
    return this.reviewService.postToAccounting(uploadId, userId);
  }

  @Post(':uploadId/reject')
  reject(
    @Param('uploadId') uploadId: string,
    @Body() body: { reason: string },
    @Query('userId') userId?: string,
  ) {
    return this.reviewService.reject(uploadId, body.reason, userId);
  }
}
