import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { STORAGE_SERVICE } from './storage.interface';
import { LocalStorageService } from './local-storage.service';
import { S3StorageService } from './s3-storage.service';

@Global()
@Module({
  providers: [
    {
      provide: STORAGE_SERVICE,
      useFactory: (config: ConfigService) => {
        const driver = config.get<string>('STORAGE_DRIVER', 'local');
        if (driver === 's3') {
          return new S3StorageService();
        }
        return new LocalStorageService(config);
      },
      inject: [ConfigService],
    },
  ],
  exports: [STORAGE_SERVICE],
})
export class StorageModule {}
