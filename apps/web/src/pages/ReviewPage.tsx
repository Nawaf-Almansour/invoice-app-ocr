import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Save,
  ThumbsUp,
  ThumbsDown,
  RotateCw,
  ZoomIn,
  ZoomOut,
  ExternalLink,
  Package,
  BookOpen,
} from 'lucide-react';
import {
  getReviewData,
  updateExtraction,
  approveInvoice,
  rejectInvoice,
  postToInventory,
  postToAccounting,
} from '../lib/api';
import type { ExtractionLine, InvoiceExtraction } from '../lib/api';
import { StatusBadge } from '../components/StatusBadge';
import { formatCurrency } from '../lib/utils';

function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</dt>
      <dd className="mt-0.5 text-sm text-gray-900">{value ?? '—'}</dd>
    </div>
  );
}

function EditableField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-1">
        {label}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-sm border border-gray-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
      />
    </div>
  );
}

const API_BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000');

export function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ['review', id],
    queryFn: () => getReviewData(id!),
    enabled: !!id,
  });

  const [edited, setEdited] = useState<Partial<InvoiceExtraction>>({});
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  const saveMutation = useMutation({
    mutationFn: () => updateExtraction(id!, edited),
    onSuccess: () => {
      setEdited({});
      queryClient.invalidateQueries({ queryKey: ['review', id] });
    },
  });

  const approveMutation = useMutation({
    mutationFn: () => approveInvoice(id!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['review', id] }),
  });

  const inventoryMutation = useMutation({
    mutationFn: () => postToInventory(id!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['review', id] }),
  });

  const accountingMutation = useMutation({
    mutationFn: () => postToAccounting(id!),
    onSuccess: () => navigate('/invoices'),
  });

  const rejectMutation = useMutation({
    mutationFn: () => rejectInvoice(id!, rejectReason),
    onSuccess: () => navigate('/invoices'),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (error || !data) {
    return <div className="text-center py-20 text-red-500">Failed to load review data.</div>;
  }

  const { extraction, validation, fileUrl, mimeType, uploadStatus } = data;

  const field = <K extends keyof InvoiceExtraction>(key: K): string =>
    String((edited[key] ?? extraction[key]) ?? '');

  const set = <K extends keyof InvoiceExtraction>(key: K) =>
    (v: string) => setEdited((prev) => ({ ...prev, [key]: v }));

  const isPdf = mimeType === 'application/pdf';
  const imageUrl = fileUrl ? `${API_BASE}${fileUrl}` : null;

  const hasValidationErrors = validation.errors.length > 0;
  const canApprove = ['NEEDS_REVIEW', 'READY', 'VALIDATING'].includes(uploadStatus) && !hasValidationErrors;
  const canPostInventory = uploadStatus === 'APPROVED';
  const canPostAccounting = uploadStatus === 'POSTED_TO_INVENTORY';
  const isPosted = ['POSTED_TO_ACCOUNTING'].includes(uploadStatus);

  const anyMutationPending =
    saveMutation.isPending ||
    approveMutation.isPending ||
    inventoryMutation.isPending ||
    accountingMutation.isPending ||
    rejectMutation.isPending;

  const mutationError =
    (approveMutation.error as Error | null)?.message ??
    (inventoryMutation.error as Error | null)?.message ??
    (accountingMutation.error as Error | null)?.message ??
    (rejectMutation.error as Error | null)?.message ??
    null;

  return (
    <div className="max-w-7xl mx-auto space-y-4 px-4 py-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Review Invoice</h1>
          <p className="text-gray-500 text-sm mt-1">
            Upload ID:{' '}
            <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{id}</code>
          </p>
        </div>
        <StatusBadge status={uploadStatus ?? (extraction.needsReview ? 'NEEDS_REVIEW' : 'READY')} />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* ── Left: Invoice image viewer ── */}
        <div className="bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50">
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              Invoice Document
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setZoom((z) => Math.max(0.4, z - 0.2))}
                className="p-1 rounded hover:bg-gray-200 text-gray-500"
                title="Zoom out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs text-gray-500 w-10 text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom((z) => Math.min(3, z + 0.2))}
                className="p-1 rounded hover:bg-gray-200 text-gray-500"
                title="Zoom in"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="p-1 rounded hover:bg-gray-200 text-gray-500"
                title="Rotate"
              >
                <RotateCw className="w-4 h-4" />
              </button>
              {imageUrl && (
                <a
                  href={imageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 rounded hover:bg-gray-200 text-gray-500"
                  title="Open original"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>
          <div className="flex-1 min-h-[500px] overflow-auto flex items-start justify-center bg-gray-100 p-4">
            {imageUrl ? (
              isPdf ? (
                <iframe
                  src={imageUrl}
                  title="Invoice PDF"
                  className="w-full rounded shadow"
                  style={{
                    height: '600px',
                    transform: `rotate(${rotation}deg)`,
                    transformOrigin: 'top center',
                  }}
                />
              ) : (
                <img
                  src={imageUrl}
                  alt="Invoice"
                  className="rounded shadow max-w-none"
                  style={{
                    transform: `scale(${zoom}) rotate(${rotation}deg)`,
                    transformOrigin: 'top center',
                    transition: 'transform 0.2s ease',
                  }}
                />
              )
            ) : (
              <div className="text-gray-400 text-sm flex flex-col items-center gap-2 mt-20">
                <XCircle className="w-10 h-10" />
                <span>No image available</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Header form + validation ── */}
        <div className="space-y-4 flex flex-col">

          {/* Validation messages */}
          {validation.errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-1">
              <p className="text-sm font-semibold text-red-700 flex items-center gap-1.5">
                <XCircle className="w-4 h-4" /> Validation Errors
              </p>
              <ul className="list-disc list-inside text-sm text-red-600 space-y-0.5">
                {validation.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            </div>
          )}

          {validation.warnings.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 space-y-1">
              <p className="text-sm font-semibold text-yellow-700 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" /> Warnings
              </p>
              <ul className="list-disc list-inside text-sm text-yellow-600 space-y-0.5">
                {validation.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </div>
          )}

          {/* Header form */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 flex-1">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Invoice Header</h2>
            <div className="grid grid-cols-2 gap-3">
              <EditableField label="Supplier Name" value={field('supplierName')} onChange={set('supplierName')} />
              <EditableField label="VAT Number" value={field('supplierVatNumber')} onChange={set('supplierVatNumber')} />
              <EditableField label="Invoice Number" value={field('invoiceNumber')} onChange={set('invoiceNumber')} />
              <EditableField label="Invoice Date" value={field('invoiceDate')} onChange={set('invoiceDate')} />
              <EditableField label="Currency" value={field('currency')} onChange={set('currency')} />
              <Field
                label="Confidence"
                value={extraction.confidence != null ? `${(extraction.confidence * 100).toFixed(0)}%` : undefined}
              />
            </div>

            {/* Totals card */}
            <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-3 gap-2">
              {[
                { label: 'Subtotal', val: extraction.subtotal },
                { label: 'VAT', val: extraction.vatAmount },
                { label: 'Total', val: extraction.total },
              ].map(({ label, val }) => (
                <div key={label} className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-xs text-gray-500 mb-0.5">{label}</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {formatCurrency(val, extraction.currency)}
                  </p>
                </div>
              ))}
            </div>

            {Object.keys(edited).length > 0 && (
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saveMutation.isPending
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Save className="w-3.5 h-3.5" />}
                  Save Changes
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Line items table */}
      {extraction.lines && extraction.lines.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900">
              Line Items ({extraction.lines.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Description</th>
                  <th className="px-4 py-3 text-right">Qty</th>
                  <th className="px-4 py-3 text-left">Unit</th>
                  <th className="px-4 py-3 text-right">Unit Price</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-left">Product ID</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {extraction.lines.map((line: ExtractionLine) => (
                  <tr key={line.id} className={line.needsReview ? 'bg-orange-50' : ''}>
                    <td className="px-4 py-3 text-gray-900 max-w-xs truncate">{line.rawName}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{line.quantity ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{line.unit ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {formatCurrency(line.unitPrice, extraction.currency)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {formatCurrency(line.lineTotal, extraction.currency)}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-gray-500">
                      {line.productId
                        ? <span className="text-green-700">{line.productId.slice(0, 8)}…</span>
                        : <span className="text-orange-500 italic">unmapped</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {line.productId ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" />
                      ) : (
                        <XCircle className="w-4 h-4 text-orange-400 mx-auto" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Status-aware action bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        {mutationError && (
          <p className="text-sm text-red-600 mb-3">
            <XCircle className="w-3.5 h-3.5 inline mr-1" />
            {mutationError}
          </p>
        )}
        {isPosted ? (
          <p className="text-sm text-green-700 font-medium flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> Invoice fully posted to accounting.
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            {/* Reject (always available unless posted) */}
            {!showRejectForm ? (
              <button
                onClick={() => setShowRejectForm(true)}
                disabled={anyMutationPending}
                className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-40"
              >
                <ThumbsDown className="w-4 h-4" /> Reject
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Reason for rejection…"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="text-sm border border-gray-300 rounded-md px-3 py-1.5 w-56 focus:outline-none focus:ring-2 focus:ring-red-300"
                />
                <button
                  onClick={() => rejectMutation.mutate()}
                  disabled={!rejectReason || rejectMutation.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  {rejectMutation.isPending
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : 'Confirm Reject'}
                </button>
                <button
                  onClick={() => setShowRejectForm(false)}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Approve */}
            {canApprove && (
              <button
                onClick={() => approveMutation.mutate()}
                disabled={anyMutationPending || hasValidationErrors}
                className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
                title={hasValidationErrors ? 'Fix validation errors first' : undefined}
              >
                {approveMutation.isPending
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <ThumbsUp className="w-4 h-4" />}
                Approve Invoice
              </button>
            )}

            {/* Post to Inventory */}
            {canPostInventory && (
              <button
                onClick={() => inventoryMutation.mutate()}
                disabled={anyMutationPending}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {inventoryMutation.isPending
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Package className="w-4 h-4" />}
                Post to Inventory
              </button>
            )}

            {/* Post to Accounting */}
            {canPostAccounting && (
              <button
                onClick={() => accountingMutation.mutate()}
                disabled={anyMutationPending}
                className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {accountingMutation.isPending
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <BookOpen className="w-4 h-4" />}
                Post to Accounting
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
