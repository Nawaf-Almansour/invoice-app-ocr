export interface ExtractedInvoiceLineDto {
  rawName: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  lineTotal?: number;
  confidence: number;
  needsReview: boolean;
}

export interface ExtractedInvoiceDto {
  supplierName?: string;
  supplierVatNumber?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  currency: 'SAR' | 'USD' | 'EUR' | string;
  subtotal?: number;
  discount?: number;
  vatAmount?: number;
  total?: number;
  items: ExtractedInvoiceLineDto[];
  confidence: number;
  warnings: string[];
}

export interface InvoiceValidationResult {
  isValid: boolean;
  needsReview: boolean;
  warnings: string[];
  errors: string[];
  confidence: number;
}
