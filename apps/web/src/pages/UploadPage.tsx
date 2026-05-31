import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { uploadInvoice } from '../lib/api';
import { cn } from '../lib/utils';

const ACCEPTED = ['image/jpeg', 'image/png', 'application/pdf'];
const MAX_MB = 20;

export function UploadPage() {
  const navigate = useNavigate();
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { mutate, isPending, isSuccess, data } = useMutation({
    mutationFn: uploadInvoice,
    onSuccess: (upload) => {
      setTimeout(() => navigate(`/processing/${upload.id}`), 800);
    },
    onError: (err: Error) => setError(err.message),
  });

  const validate = (f: File): string | null => {
    if (!ACCEPTED.includes(f.type)) return 'Only JPEG, PNG, and PDF files are accepted.';
    if (f.size > MAX_MB * 1024 * 1024) return `File must be under ${MAX_MB}MB.`;
    return null;
  };

  const handleFile = (f: File) => {
    const msg = validate(f);
    if (msg) { setError(msg); setFile(null); return; }
    setError(null);
    setFile(f);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (!f) return;
    const msg = validate(f);
    if (msg) { setError(msg); setFile(null); return; }
    setError(null);
    setFile(f);
  }, []);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const handleSubmit = () => {
    if (file) mutate(file);
  };

  return (
    <div className="max-w-xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Upload Invoice</h1>
        <p className="text-gray-500 mt-1 text-sm">Upload a JPEG, PNG, or PDF invoice to begin OCR processing.</p>
      </div>

      <div
        onDrop={onDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        className={cn(
          'relative border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center gap-4 transition-colors cursor-pointer',
          dragOver ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 bg-white hover:border-indigo-400 hover:bg-gray-50',
          file && 'border-green-400 bg-green-50',
        )}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <input
          id="file-input"
          type="file"
          accept={ACCEPTED.join(',')}
          className="hidden"
          onChange={onInputChange}
        />

        {file ? (
          <>
            <FileText className="w-12 h-12 text-green-500" />
            <div className="text-center">
              <p className="font-medium text-gray-900">{file.name}</p>
              <p className="text-sm text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
          </>
        ) : (
          <>
            <Upload className="w-12 h-12 text-gray-400" />
            <div className="text-center">
              <p className="font-medium text-gray-700">Drag & drop or click to select</p>
              <p className="text-sm text-gray-400 mt-1">JPEG, PNG, PDF up to {MAX_MB}MB</p>
            </div>
          </>
        )}
      </div>

      {error && (
        <div className="mt-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {isSuccess && data && (
        <div className="mt-3 flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          Uploaded successfully! Redirecting to processing…
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={!file || isPending || isSuccess}
        className={cn(
          'mt-4 w-full flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-medium text-sm transition-colors',
          file && !isPending && !isSuccess
            ? 'bg-indigo-600 text-white hover:bg-indigo-700'
            : 'bg-gray-200 text-gray-400 cursor-not-allowed',
        )}
      >
        {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
        {isPending ? 'Uploading…' : 'Upload & Process'}
      </button>
    </div>
  );
}
