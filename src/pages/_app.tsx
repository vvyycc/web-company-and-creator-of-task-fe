import type { AppProps } from 'next/app';
import { SessionProvider } from 'next-auth/react';
import '@/styles/globals.css';

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <SessionProvider session={(pageProps as any).session}>
      <Component {...pageProps} />
    </SessionProvider>
  );
}
