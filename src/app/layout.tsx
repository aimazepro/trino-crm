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
      <body className={`${inter.variable} font-sans antialiased`}>
        <CrmProvider>
          <div className="flex h-screen overflow-hidden bg-[#F4F4F5]">
            <div className="hidden md:flex">
              <Sidebar />
            </div>
            <div className="flex flex-col flex-1 overflow-hidden">
              <Topbar />
              <main className="flex-1 overflow-y-auto">
                {children}
              </main>
            </div>
          </div>
        </CrmProvider>
      </body>
    </html>
  );
}
