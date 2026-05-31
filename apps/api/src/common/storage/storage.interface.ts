export const STORAGE_SERVICE = 'STORAGE_SERVICE';

export interface StorageService {
  save(file: Buffer, key: string): Promise<string>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  getUrl(key: string): string;
}
