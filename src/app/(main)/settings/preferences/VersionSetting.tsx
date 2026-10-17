'use client';

import { Text } from '@umami/react-zen';
import { BRAND } from '@/lib/brand';
import { CURRENT_VERSION } from '@/lib/constants';

export function VersionSetting() {
  return (
    <Text>
      {`${BRAND.name} ${CURRENT_VERSION} · Built on ${BRAND.upstreamName} (${BRAND.upstreamLicense})`}
    </Text>
  );
}
