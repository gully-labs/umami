import type { SVGProps } from 'react';
import { BRAND } from '@/lib/brand';

/* Gully Analytics mark. Kept as an <svg> so existing <Icon> sizing keeps working. */
const SvgLogo = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={20}
    height={20}
    viewBox="0 0 128 128"
    role="img"
    aria-label={BRAND.name}
    {...props}
  >
    <image href={`${process.env.basePath || ''}${BRAND.logo}`} width={128} height={128} />
  </svg>
);
export default SvgLogo;
