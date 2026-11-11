import { useConfig } from '@/components/hooks';
import { GROUPED_DOMAINS } from '@/lib/constants';

function getHostName(url: string) {
  const match = url.match(/^(?:https?:\/\/)?(?:[^@\n]+@)?([^:/\n?=]+)/im);
  return match && match.length > 1 ? match[1] : null;
}

/*
 * Gully Analytics: a local letter badge by default, so the dashboard never sends visitor domains
 * to a third-party icon service and never logs a 404 for a site without an icon. Set FAVICON_URL
 * (e.g. https://icons.duckduckgo.com/ip3/{{domain}}.ico) to load real icons as upstream Umami does.
 */
export function Favicon({ domain, ...props }) {
  const config = useConfig();

  if (config?.privateMode) {
    return null;
  }

  const hostName = domain ? getHostName(domain) : null;

  if (!hostName) {
    return null;
  }

  const domainName = GROUPED_DOMAINS[hostName]?.domain || hostName;

  if (config?.faviconUrl) {
    const src = config.faviconUrl.replace(/\{\{\s*domain\s*}}/, domainName);
    return <img src={src} width={16} height={16} alt="" {...props} />;
  }

  const letter =
    domainName
      .replace(/^www\./, '')
      .charAt(0)
      .toUpperCase() || '?';

  return (
    <span
      aria-hidden
      {...props}
      style={{
        display: 'inline-grid',
        placeItems: 'center',
        width: 16,
        height: 16,
        flex: '0 0 16px',
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 700,
        lineHeight: 1,
        background: 'var(--gully-blue, #3754a0)',
        color: 'var(--gully-ground, #f1f3f8)',
        ...((props as any)?.style ?? {}),
      }}
    >
      {letter}
    </span>
  );
}
