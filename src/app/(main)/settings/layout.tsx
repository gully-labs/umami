import type { Metadata } from 'next';
import { BRAND } from '@/lib/brand';
import { SettingsLayout } from './SettingsLayout';

export default function ({ children }) {
  if (process.env.cloudMode) {
    return null;
  }

  return <SettingsLayout>{children}</SettingsLayout>;
}

export const metadata: Metadata = {
  title: {
    template: `%s | Settings | ${BRAND.name}`,
    default: `Settings | ${BRAND.name}`,
  },
};
