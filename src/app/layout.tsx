import type { Metadata } from 'next';
import Topbar from '@/components/Navbar';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'Football Power Rankings',
  description: 'ML-powered NFL and college football power rankings',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="mx-auto max-w-5xl bg-black">
        <Topbar />
        <div className="pt-24">{children}</div>
      </body>
    </html>
  );
}
