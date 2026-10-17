import type { Metadata } from 'next';
import { Barlow_Condensed, Hanken_Grotesk, IBM_Plex_Mono } from 'next/font/google';
import { headers } from 'next/headers';
import { Suspense } from 'react';
import { BRAND } from '@/lib/brand';
import { getBaseUrl } from '@/lib/get-base-url';
import { Providers } from './Providers';
import '@umami/react-zen/styles.full.css';
import './global.css';

// Gully Analytics typefaces (body / headings / mono).
const body = Hanken_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-body',
});

const heading = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  display: 'swap',
  variable: '--font-heading',
});

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-mono',
});

export default function ({ children }) {
  if (process.env.DISABLE_UI) {
    return (
      <html>
        <body></body>
      </html>
    );
  }

  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${body.className} ${body.variable} ${heading.variable} ${mono.variable}`}
    >
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="manifest" href="/site.webmanifest" crossOrigin="use-credentials" />
        <meta name="msapplication-TileColor" content="#0B0E13" />
        <meta name="theme-color" content="#0B0E13" />
        <meta name="robots" content="noindex,nofollow" />
      </head>
      <body>
        <Suspense>
          <Providers>{children}</Providers>
        </Suspense>
      </body>
    </html>
  );
}

export async function generateMetadata(): Promise<Metadata> {
  const headerStore = await headers();

  return {
    metadataBase: getBaseUrl(headerStore),
    title: {
      template: `%s | ${BRAND.name}`,
      default: BRAND.name,
    },
  };
}
