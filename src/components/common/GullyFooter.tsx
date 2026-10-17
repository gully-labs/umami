import { Row, Text } from '@umami/react-zen';
import { BRAND } from '@/lib/brand';

/* Gully Analytics footer with the required upstream credit. */
export function GullyFooter() {
  return (
    <Row
      as="footer"
      justifyContent="center"
      alignItems="center"
      gap="2"
      wrap="wrap"
      paddingY="6"
      paddingX="3"
      width="100%"
    >
      <Text size="sm" color="muted">
        {BRAND.name} ·{' '}
        <a href={BRAND.companyUrl} target="_blank" rel="noopener" style={{ color: 'inherit' }}>
          by {BRAND.company}
        </a>{' '}
        ·{' '}
        <a href={BRAND.upstreamUrl} target="_blank" rel="noopener" style={{ color: 'inherit' }}>
          Built on {BRAND.upstreamName} ({BRAND.upstreamLicense})
        </a>
      </Text>
    </Row>
  );
}
