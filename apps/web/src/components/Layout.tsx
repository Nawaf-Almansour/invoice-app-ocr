import { Link, useLocation } from 'react-router-dom';
import { FileText, Upload, List, CheckSquare } from 'lucide-react';
import { cn } from '../lib/utils';

const NAV = [
  { to: '/', label: 'Upload', icon: Upload },
  { to: '/invoices', label: 'All Invoices', icon: List },
  { to: '/review', label: 'Review', icon: CheckSquare },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2 font-semibold text-gray-900">
            <FileText className="w-5 h-5 text-indigo-600" />
            Invoice OCR
          </Link>
          <nav className="flex items-center gap-1 ml-4">
            {NAV.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                  pathname === to
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">{children}</main>
    </div>
  );
}
