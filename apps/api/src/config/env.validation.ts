import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string;

  @IsString()
  @IsOptional()
  REDIS_HOST: string = 'localhost';

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(65535)
  REDIS_PORT: number = 6379;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(65535)
  PORT: number = 3000;

  @IsString()
  @IsOptional()
  UPLOAD_DIR: string = './uploads';

  @IsString()
  @IsOptional()
  OCR_WORKER_URL: string = 'http://ocr-worker:8000';

  @IsString()
  @IsOptional()
  DB_SYNC: string = 'false';

  @IsString()
  @IsOptional()
  STORAGE_DRIVER: string = 'local';
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(
      `Environment validation failed:\n${errors.map((e) => Object.values(e.constraints ?? {}).join(', ')).join('\n')}`,
    );
  }

  if (
    validatedConfig.NODE_ENV === Environment.Production &&
    validatedConfig.DB_SYNC === 'true'
  ) {
    throw new Error(
      'FATAL: DB_SYNC=true is not allowed in production. Use migrations instead.',
    );
  }

  return validatedConfig;
}
