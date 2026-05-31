import axios from 'axios';

export const api = axios.create({
  baseURL: (import.meta.env.VITE_API_URL ?? 'http://localhost:3000') + '/api/v1',
  timeout: 30000,
});

export interface InvoiceUpload {
  id: string;
  fileUrl: string;
  originalFileName: string;
  mimeType: string;
  status: string;
  errorMessage?: string;
  uploadedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExtractionLine {
  id: string;
  rawName: string;
  productId?: string;
  quantity?: number;
  unit?: string;
  unitPrice?: number;
  lineTotal?: number;
  confidence?: number;
  needsReview: boolean;
}

export interface InvoiceExtraction {
  id: string;
  invoiceUploadId: string;
  supplierName?: string;
  supplierVatNumber?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  subtotal?: number;
  vatAmount?: number;
  total?: number;
  currency?: string;
  confidence?: number;
  needsReview: boolean;
  validationJson?: Record<string, unknown>;
  lines?: ExtractionLine[];
}

export interface ValidationResult {
  isValid: boolean;
  needsReview: boolean;
  errors: string[];
  warnings: string[];
}

export interface ReviewData {
  extraction: InvoiceExtraction;
  validation: ValidationResult;
  fileUrl: string;
  mimeType: string;
  uploadStatus: string;
}

export interface VendorItemMapping {
  id: string;
  rawVendorItemName: string;
  normalizedVendorItemName: string;
  productId: string;
  sourceUnit?: string;
  targetUnit?: string;
  confidence?: number;
}

export const uploadInvoice = async (file: File): Promise<InvoiceUpload> => {
  const form = new FormData();
  form.append('file', file);
  const res = await api.post<InvoiceUpload>('/invoices/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
};

export const getUploadStatus = async (id: string): Promise<{ id: string; status: string }> => {
  const res = await api.get(`/invoices/${id}/status`);
  return res.data;
};

export const listUploads = async (): Promise<InvoiceUpload[]> => {
  const res = await api.get<InvoiceUpload[]>('/invoices');
  return res.data;
};

export const getReviewData = async (uploadId: string): Promise<ReviewData> => {
  const res = await api.get<ReviewData>(`/invoice-review/${uploadId}`);
  return res.data;
};

export const updateExtraction = async (
  uploadId: string,
  data: Partial<InvoiceExtraction> & { lines?: Partial<ExtractionLine>[] },
): Promise<InvoiceExtraction> => {
  const res = await api.patch<InvoiceExtraction>(`/invoice-review/${uploadId}`, data);
  return res.data;
};

export const approveInvoice = async (uploadId: string): Promise<unknown> => {
  const res = await api.post(`/invoice-review/${uploadId}/approve`);
  return res.data;
};

export const rejectInvoice = async (uploadId: string, reason: string): Promise<unknown> => {
  const res = await api.post(`/invoice-review/${uploadId}/reject`, { reason });
  return res.data;
};

export const postToInventory = async (uploadId: string): Promise<unknown> => {
  const res = await api.post(`/invoice-review/${uploadId}/post-to-inventory`);
  return res.data;
};

export const postToAccounting = async (uploadId: string): Promise<unknown> => {
  const res = await api.post(`/invoice-review/${uploadId}/post-to-accounting`);
  return res.data;
};

export const getMappingSuggestions = async (
  rawName: string,
  supplierId?: string,
): Promise<VendorItemMapping[]> => {
  const res = await api.get<VendorItemMapping[]>('/product-mappings/suggestions', {
    params: { rawName, supplierId },
  });
  return res.data;
};

export const saveMapping = async (data: {
  supplierId?: string;
  rawVendorItemName: string;
  productId: string;
  sourceUnit?: string;
}): Promise<VendorItemMapping> => {
  const res = await api.post<VendorItemMapping>('/product-mappings', data);
  return res.data;
};
