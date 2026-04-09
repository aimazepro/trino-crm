import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { CrmProvider } from '@/contexts/crm-context';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Trino Flow | Marketing Hub',
  description: 'CRM e Automações para sua Agência',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased bg-gray-50/50`}>
        <CrmProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0 bg-background/50">
              <Topbar />
              <main className="flex-1 flex flex-col p-6 overflow-auto">
                {children}
              </main>
            </div>
          </div>
        </CrmProvider>
      </body>
    </html>
  );
}
