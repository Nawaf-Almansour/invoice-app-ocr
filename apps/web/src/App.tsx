import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from './components/Layout';
import { UploadPage } from './pages/UploadPage';
import { ProcessingPage } from './pages/ProcessingPage';
import { InvoiceListPage } from './pages/InvoiceListPage';
import { ReviewPage } from './pages/ReviewPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, staleTime: 10_000 },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<UploadPage />} />
            <Route path="/invoices" element={<InvoiceListPage />} />
            <Route path="/processing/:id" element={<ProcessingPage />} />
            <Route path="/review/:id" element={<ReviewPage />} />
            <Route path="/review" element={<InvoiceListPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
