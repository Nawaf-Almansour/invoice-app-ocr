import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { FileText, Loader2, ChevronRight } from 'lucide-react';
import { listUploads } from '../lib/api';
import { StatusBadge } from '../components/StatusBadge';
import { formatDate } from '../lib/utils';

export function InvoiceListPage() {
  const { data: uploads, isLoading, error } = useQuery({
    queryKey: ['uploads'],
    queryFn: listUploads,
    refetchInterval: 10000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20 text-red-500">
        Failed to load invoices.
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">All Invoices</h1>
          <p className="text-gray-500 text-sm mt-1">{uploads?.length ?? 0} invoice(s) total</p>
        </div>
        <Link
          to="/"
          className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          + Upload New
        </Link>
      </div>

      {!uploads?.length ? (
        <div className="text-center py-20 border-2 border-dashed border-gray-200 rounded-xl">
          <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No invoices yet. Upload one to get started.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
          {uploads.map((upload) => {
            const needsReview = ['NEEDS_REVIEW', 'READY'].includes(upload.status);
            const isProcessing = ['QUEUED', 'PROCESSING_OCR', 'OCR_COMPLETED', 'EXTRACTING', 'VALIDATING'].includes(upload.status);

            return (
              <div key={upload.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                <FileText className="w-5 h-5 text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{upload.originalFileName}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{formatDate(upload.createdAt)}</p>
                </div>
                <StatusBadge status={upload.status} />
                {needsReview ? (
                  <Link
                    to={`/review/${upload.id}`}
                    className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 flex-shrink-0"
                  >
                    Review <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                ) : isProcessing ? (
                  <Link
                    to={`/processing/${upload.id}`}
                    className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 flex-shrink-0"
                  >
                    View <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
