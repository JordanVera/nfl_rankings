import type { Metadata, Viewport } from 'next';
import Topbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'Football Power Rankings',
  description: 'ML-powered NFL and college football power rankings',
};

export const viewport: Viewport = {
  themeColor: '#FF5F1F',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="mx-auto flex min-h-screen max-w-[1200px] flex-col bg-black">
        <Topbar />
        <div className="flex-1 pt-24">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
