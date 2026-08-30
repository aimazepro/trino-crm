import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'TrinoDeal | Marketing Hub',
  description: 'CRM e Automações para sua Agência',
};

// Só html/body/fonte. Quem monta o shell do CRM é src/app/(crm)/layout.tsx --
// ver o comentário de lá antes de mover qualquer coisa de volta pra cá.
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
