import type { Metadata } from 'next';
import Topbar from '@/components/Topbar';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'NFL Power Rankings',
  description: 'ML-powered NFL team power rankings',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-black">
        <Topbar />
        {children}
      </body>
    </html>
  );
}
