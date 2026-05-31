import { Injectable, NotImplementedException } from '@nestjs/common';
import type { StorageService } from './storage.interface';

// TODO: Implement with @aws-sdk/client-s3 for MinIO/S3 support
// Install: npm install @aws-sdk/client-s3
// Env vars: S3_BUCKET, S3_REGION, S3_ENDPOINT (for MinIO), AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY

@Injectable()
export class S3StorageService implements StorageService {
  async save(_file: Buffer, _key: string): Promise<string> {
    throw new NotImplementedException('S3 storage not yet implemented');
  }

  async get(_key: string): Promise<Buffer> {
    throw new NotImplementedException('S3 storage not yet implemented');
  }

  async delete(_key: string): Promise<void> {
    throw new NotImplementedException('S3 storage not yet implemented');
  }

  getUrl(_key: string): string {
    throw new NotImplementedException('S3 storage not yet implemented');
  }
}
