import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | undefined | null, currency = 'SAR'): string {
  if (amount == null) return '—';
  return new Intl.NumberFormat('ar-SA', { style: 'currency', currency }).format(amount);
}

export function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-SA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export const STATUS_LABELS: Record<string, string> = {
  UPLOADED: 'Uploaded',
  QUEUED: 'Queued',
  PROCESSING_OCR: 'Processing OCR',
  OCR_COMPLETED: 'OCR Complete',
  EXTRACTING: 'Extracting',
  VALIDATING: 'Validating',
  NEEDS_REVIEW: 'Needs Review',
  READY: 'Ready',
  APPROVED: 'Approved',
  POSTED_TO_INVENTORY: 'Posted to Inventory',
  POSTED_TO_ACCOUNTING: 'Posted to Accounting',
  OCR_FAILED: 'OCR Failed',
  EXTRACTION_FAILED: 'Extraction Failed',
  VALIDATION_FAILED: 'Validation Failed',
  POSTING_FAILED: 'Posting Failed',
};

export const STATUS_COLORS: Record<string, string> = {
  UPLOADED: 'bg-gray-100 text-gray-700',
  QUEUED: 'bg-blue-100 text-blue-700',
  PROCESSING_OCR: 'bg-yellow-100 text-yellow-700',
  OCR_COMPLETED: 'bg-cyan-100 text-cyan-700',
  EXTRACTING: 'bg-yellow-100 text-yellow-700',
  VALIDATING: 'bg-purple-100 text-purple-700',
  NEEDS_REVIEW: 'bg-orange-100 text-orange-700',
  READY: 'bg-emerald-100 text-emerald-700',
  APPROVED: 'bg-green-100 text-green-700',
  POSTED_TO_INVENTORY: 'bg-teal-100 text-teal-700',
  POSTED_TO_ACCOUNTING: 'bg-indigo-100 text-indigo-700',
  OCR_FAILED: 'bg-red-100 text-red-700',
  EXTRACTION_FAILED: 'bg-red-100 text-red-700',
  VALIDATION_FAILED: 'bg-red-100 text-red-700',
  POSTING_FAILED: 'bg-red-100 text-red-700',
};

export const PROCESSING_STATUSES = new Set([
  'QUEUED',
  'PROCESSING_OCR',
  'OCR_COMPLETED',
  'EXTRACTING',
  'VALIDATING',
]);
