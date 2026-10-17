import type { Metadata } from 'next';
import { BRAND } from '@/lib/brand';
import { AdminLayout } from './AdminLayout';

export default function ({ children }) {
  if (process.env.cloudMode) {
    return null;
  }

  return <AdminLayout>{children}</AdminLayout>;
}

export const metadata: Metadata = {
  title: {
    template: `%s | Admin | ${BRAND.name}`,
    default: `Admin | ${BRAND.name}`,
  },
};
