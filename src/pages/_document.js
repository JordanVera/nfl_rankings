import Topbar from '@/components/Topbar';
import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@latest"></script>
        <script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-vis"></script>
      </Head>
      <body className="bg-black">
        <Topbar />
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
