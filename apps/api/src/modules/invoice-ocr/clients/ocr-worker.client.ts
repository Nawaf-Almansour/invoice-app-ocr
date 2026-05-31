import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';

export interface OcrLineBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface OcrLine {
  text: string;
  confidence: number;
  box: OcrLineBox;
}

export interface OcrWorkerRequest {
  invoiceUploadId: string;
  filePath: string;
  mode: 'hybrid' | 'ppocrv5' | 'vl';
  languageHints?: string[];
}

export interface OcrPage {
  pageNumber: number;
  lines: OcrLine[];
  rawText: string;
  confidence: number;
}

export interface QrResult {
  rawText: string;
  zatca?: {
    sellerName?: string;
    vatNumber?: string;
    timestamp?: string;
    total?: string;
    vatAmount?: string;
  };
}

export interface OcrWorkerResponse {
  engine: string;
  engineVersion?: string;
  rawText: string;
  confidence: number;
  pages: OcrPage[];
  lines: OcrLine[];
  qr?: QrResult;
  markdown?: string;
  documentJson?: Record<string, unknown>;
  usedEnhancedFallback: boolean;
  warnings: string[];
  timings: Record<string, number>;
}

@Injectable()
export class OcrWorkerClient {
  private readonly logger = new Logger(OcrWorkerClient.name);

  constructor(
    private readonly http: HttpService,
    private readonly config: ConfigService,
  ) {}

  async scan(request: OcrWorkerRequest): Promise<OcrWorkerResponse> {
    const baseUrl = this.config.get<string>(
      'OCR_WORKER_URL',
      'http://ocr-worker:8000',
    );

    const mockMode =
      baseUrl === 'mock' ||
      this.config.get<string>('MOCK_OCR', 'false') === 'true';

    if (mockMode) {
      this.logger.warn(
        `MOCK_OCR enabled — returning synthetic data for upload ${request.invoiceUploadId}`,
      );
      return this.mockResponse();
    }

    const url = `${baseUrl}/api/v1/ocr/scan`;

    this.logger.log(
      `Calling OCR worker: ${url} for upload ${request.invoiceUploadId}`,
    );

    const response = await firstValueFrom(
      this.http.post<OcrWorkerResponse>(url, request, {
        timeout: 120000,
      }),
    );

    return response.data;
  }

  private mockResponse(): OcrWorkerResponse {
    const makeBox = (y: number): OcrLineBox => ({
      x1: 50,
      y1: y,
      x2: 540,
      y2: y + 22,
    });

    // Unique invoice number per run to avoid duplicate validation errors
    const invNum = `INV-2025-${String(Date.now()).slice(-5)}`;

    // Realistic Saudi VAT invoice: subtotal=250, VAT=37.50 (15%), total=287.50
    // Each line item is a SINGLE OCR entry: "<name>  <qty>  <unitPrice>  <total>"
    // so parseLineItem receives [name, qty, unitPrice, total] as cells from one row
    const lines: OcrLine[] = [
      {
        text: 'فاتورة ضريبية',
        confidence: 0.99,
        box: makeBox(30),
      },
      {
        text: 'المورد: شركة النجم للمستلزمات المكتبية',
        confidence: 0.98,
        box: makeBox(60),
      },
      {
        text: 'الرقم الضريبي: 300987654300003',
        confidence: 0.97,
        box: makeBox(90),
      },
      {
        text: `رقم الفاتورة: ${invNum}`,
        confidence: 0.98,
        box: makeBox(120),
      },
      {
        text: 'التاريخ: 2025-11-10',
        confidence: 0.99,
        box: makeBox(150),
      },
      // Table header row — triggers inTable mode (2+ keyword matches)
      {
        text: 'الوصف',
        confidence: 0.99,
        box: { x1: 50, y1: 185, x2: 200, y2: 207 },
      },
      {
        text: 'الكمية',
        confidence: 0.99,
        box: { x1: 210, y1: 185, x2: 280, y2: 207 },
      },
      {
        text: 'سعر الوحدة',
        confidence: 0.99,
        box: { x1: 290, y1: 185, x2: 390, y2: 207 },
      },
      {
        text: 'الإجمالي',
        confidence: 0.99,
        box: { x1: 400, y1: 185, x2: 540, y2: 207 },
      },
      // Line items: multiple OcrLine entries at same Y → grouped into one row by Y-threshold
      {
        text: 'أقلام حبر أسود باك 12 حبة',
        confidence: 0.95,
        box: { x1: 50, y1: 215, x2: 200, y2: 237 },
      },
      {
        text: '3',
        confidence: 0.95,
        box: { x1: 210, y1: 215, x2: 240, y2: 237 },
      },
      {
        text: '30.00',
        confidence: 0.95,
        box: { x1: 290, y1: 215, x2: 360, y2: 237 },
      },
      {
        text: '90.00',
        confidence: 0.95,
        box: { x1: 400, y1: 215, x2: 470, y2: 237 },
      },
      {
        text: 'دفاتر ملاحظات A4 سلك',
        confidence: 0.95,
        box: { x1: 50, y1: 245, x2: 200, y2: 267 },
      },
      {
        text: '4',
        confidence: 0.95,
        box: { x1: 210, y1: 245, x2: 240, y2: 267 },
      },
      {
        text: '20.00',
        confidence: 0.95,
        box: { x1: 290, y1: 245, x2: 360, y2: 267 },
      },
      {
        text: '80.00',
        confidence: 0.95,
        box: { x1: 400, y1: 245, x2: 470, y2: 267 },
      },
      {
        text: 'ورق طباعة A4 رزمة 500 ورقة',
        confidence: 0.96,
        box: { x1: 50, y1: 275, x2: 200, y2: 297 },
      },
      {
        text: '2',
        confidence: 0.96,
        box: { x1: 210, y1: 275, x2: 240, y2: 297 },
      },
      {
        text: '40.00',
        confidence: 0.96,
        box: { x1: 290, y1: 275, x2: 360, y2: 297 },
      },
      {
        text: '80.00',
        confidence: 0.96,
        box: { x1: 400, y1: 275, x2: 470, y2: 297 },
      },
      {
        text: 'المجموع قبل الضريبة: 250.00 ريال',
        confidence: 0.98,
        box: makeBox(330),
      },
      {
        text: 'ضريبة القيمة المضافة (15%): 37.50 ريال',
        confidence: 0.97,
        box: makeBox(360),
      },
      {
        text: 'الإجمالي المستحق: 287.50 ريال سعودي',
        confidence: 0.98,
        box: makeBox(390),
      },
    ];

    const rawText = lines.map((l) => l.text).join('\n');

    return {
      engine: 'mock-v1',
      rawText,
      confidence: 0.97,
      lines,
      markdown: rawText,
      documentJson: null as unknown as Record<string, unknown>,
      usedEnhancedFallback: false,
      warnings: [],
      timings: {},
      pages: [
        {
          pageNumber: 1,
          lines,
          rawText,
          confidence: 0.97,
        },
      ],
    };
  }
}
