import type { Metadata } from 'next';
import Script from 'next/script';
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
        <Script
          src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@latest"
          strategy="beforeInteractive"
        />
        <Script
          src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-vis"
          strategy="beforeInteractive"
        />
        <Topbar />
        {children}
      </body>
    </html>
  );
}
