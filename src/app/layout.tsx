import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LifePlan — Plan the life you want',
  description:
    'Plan the lifestyle you want in later life and understand how your income sources and assets can fund it.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50">{children}</body>
    </html>
  );
}
