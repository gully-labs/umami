'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, ZenProvider } from '@umami/react-zen';
import { NextIntlClientProvider } from 'next-intl';
import { useEffect } from 'react';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { useLocale } from '@/components/hooks';
import 'chartjs-adapter-date-fns';

const client = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60,
    },
  },
});

function MessagesProvider({ children }) {
  const { locale, messages, dir } = useLocale();

  useEffect(() => {
    document.documentElement.setAttribute('dir', dir);
    document.documentElement.setAttribute('lang', locale);
  }, [locale, dir]);

  return (
    <NextIntlClientProvider locale={locale} messages={messages[locale]} onError={() => null}>
      {children}
    </NextIntlClientProvider>
  );
}

// Gully Analytics defaults to the dark theme until the user picks one (Zen stores it as "theme").
function getPreferredTheme(): 'light' | 'dark' | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    return window.localStorage.getItem('theme') ? undefined : 'dark';
  } catch {
    return 'dark';
  }
}

export function Providers({ children }) {
  return (
    <ZenProvider theme={getPreferredTheme()}>
      <RouterProvider>
        <MessagesProvider>
          <QueryClientProvider client={client}>
            <ErrorBoundary>{children}</ErrorBoundary>
          </QueryClientProvider>
        </MessagesProvider>
      </RouterProvider>
    </ZenProvider>
  );
}
