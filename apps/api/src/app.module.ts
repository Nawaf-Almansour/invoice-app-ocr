import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validate } from './config/env.validation';
import { InvoiceUploadsModule } from './modules/invoice-uploads/invoice-uploads.module';
import { InvoiceOcrModule } from './modules/invoice-ocr/invoice-ocr.module';
import { InvoiceExtractionModule } from './modules/invoice-extraction/invoice-extraction.module';
import { InvoiceValidationModule } from './modules/invoice-validation/invoice-validation.module';
import { InvoiceReviewModule } from './modules/invoice-review/invoice-review.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { ProductMappingModule } from './modules/product-mapping/product-mapping.module';
import { PurchaseInvoicesModule } from './modules/purchase-invoices/purchase-invoices.module';
import { InventoryPostingModule } from './modules/inventory-posting/inventory-posting.module';
import { AccountingPostingModule } from './modules/accounting-posting/accounting-posting.module';
import { AuditLogModule } from './modules/audit-log/audit-log.module';
import { StorageModule } from './common/storage/storage.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.development', '.env'],
      validate,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize:
          config.get<string>('NODE_ENV') !== 'production' &&
          config.get<string>('DB_SYNC') === 'true',
        logging: config.get<string>('NODE_ENV') === 'development',
      }),
    }),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
        },
      }),
    }),
    StorageModule,
    InvoiceUploadsModule,
    InvoiceOcrModule,
    InvoiceExtractionModule,
    InvoiceValidationModule,
    InvoiceReviewModule,
    SuppliersModule,
    ProductMappingModule,
    PurchaseInvoicesModule,
    InventoryPostingModule,
    AccountingPostingModule,
    AuditLogModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
