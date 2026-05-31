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
  mode: 'auto' | 'fast' | 'accurate';
  languageHints?: string[];
}

export interface OcrWorkerResponse {
  engine: string;
  rawText: string;
  confidence: number;
  lines: OcrLine[];
  markdown?: string;
  documentJson?: Record<string, unknown>;
  usedVl: boolean;
}
