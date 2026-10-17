import type { Metadata } from 'next';
import { Suspense } from 'react';
import { BRAND } from '@/lib/brand';
import { App } from './App';

export default function ({ children }) {
  return (
    <Suspense>
      <App>{children}</App>
    </Suspense>
  );
}

export const metadata: Metadata = {
  title: {
    template: `%s | ${BRAND.name}`,
    default: BRAND.name,
  },
};
