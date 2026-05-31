import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Loader2, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { getUploadStatus } from '../lib/api';
import { StatusBadge } from '../components/StatusBadge';
import { PROCESSING_STATUSES } from '../lib/utils';

const TERMINAL_OK = new Set(['NEEDS_REVIEW', 'READY', 'APPROVED', 'POSTED_TO_INVENTORY', 'POSTED_TO_ACCOUNTING']);
const TERMINAL_ERR = new Set(['OCR_FAILED', 'EXTRACTION_FAILED', 'VALIDATION_FAILED', 'POSTING_FAILED']);

const STEPS = [
  { key: 'QUEUED', label: 'Queued' },
  { key: 'PROCESSING_OCR', label: 'Running OCR' },
  { key: 'OCR_COMPLETED', label: 'OCR Complete' },
  { key: 'EXTRACTING', label: 'Extracting Data' },
  { key: 'VALIDATING', label: 'Validating' },
  { key: 'NEEDS_REVIEW', label: 'Ready for Review' },
];

const STEP_ORDER = STEPS.map((s) => s.key);

function stepIndex(status: string) {
  const idx = STEP_ORDER.indexOf(status);
  return idx === -1 ? (TERMINAL_OK.has(status) ? STEP_ORDER.length : -1) : idx;
}

export function ProcessingPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, error } = useQuery({
    queryKey: ['status', id],
    queryFn: () => getUploadStatus(id!),
    refetchInterval: (query) => {
      const s = query.state.data?.status ?? '';
      if (PROCESSING_STATUSES.has(s)) return 2000;
      return false;
    },
    enabled: !!id,
  });

  const status = data?.status ?? 'QUEUED';
  const isProcessing = PROCESSING_STATUSES.has(status);
  const isReady = TERMINAL_OK.has(status);
  const isFailed = TERMINAL_ERR.has(status);
  const currentStep = stepIndex(status);

  useEffect(() => {
    if (isReady && status === 'NEEDS_REVIEW') {
      setTimeout(() => navigate(`/review/${id}`), 1200);
    } else if (isReady && status === 'READY') {
      setTimeout(() => navigate(`/review/${id}`), 1200);
    }
  }, [status, isReady, id, navigate]);

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Processing Invoice</h1>
        <p className="text-gray-500 mt-1 text-sm">Invoice ID: <code className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{id}</code></p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <span className="text-sm font-medium text-gray-600">Current Status</span>
          <StatusBadge status={status} />
        </div>

        <ol className="space-y-3">
          {STEPS.map((step, i) => {
            const done = i < currentStep;
            const active = i === currentStep && isProcessing;
            const failed = isFailed && i === currentStep;

            return (
              <li key={step.key} className="flex items-center gap-3">
                <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold
                  ${done ? 'bg-green-500 text-white' : active ? 'bg-indigo-500 text-white' : failed ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                  {done ? <CheckCircle2 className="w-4 h-4" /> : active ? <Loader2 className="w-4 h-4 animate-spin" /> : failed ? <XCircle className="w-4 h-4" /> : i + 1}
                </span>
                <span className={`text-sm ${done ? 'text-gray-900 font-medium' : active ? 'text-indigo-700 font-medium' : 'text-gray-400'}`}>
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>

        {error && (
          <div className="mt-4 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            <XCircle className="w-4 h-4 flex-shrink-0" />
            Failed to fetch status. Retrying…
          </div>
        )}

        {isFailed && (
          <div className="mt-4 flex items-center gap-2 text-sm text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            Processing failed at step <strong>{STATUS_LABELS[status] ?? status}</strong>. Check logs for details.
          </div>
        )}

        {isReady && (
          <div className="mt-4 flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            Processing complete! Redirecting to review…
          </div>
        )}
      </div>
    </div>
  );
}

const STATUS_LABELS: Record<string, string> = {
  OCR_FAILED: 'OCR',
  EXTRACTION_FAILED: 'Extraction',
  VALIDATION_FAILED: 'Validation',
  POSTING_FAILED: 'Posting',
};
