'use client';
import { Button, Column, Heading, Row, Text, useToast } from '@umami/react-zen';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { WebsiteAddForm } from '@/app/(main)/websites/WebsiteAddForm';
import { WebsiteTrackingCode } from '@/app/(main)/websites/[websiteId]/settings/WebsiteTrackingCode';
import { useApi, useModified } from '@/components/hooks';
import { BRAND } from '@/lib/brand';
import styles from './GullyOnboarding.module.css';

type Site = { id: string; name: string; domain: string };

/** Polls the new website until its first event is stored (Umami's own date range of events). */
function useFirstEvent(websiteId?: string) {
  const { get } = useApi();
  return useQuery({
    queryKey: ['gully-first-event', websiteId],
    queryFn: () => get(`/websites/${websiteId}/daterange`),
    enabled: !!websiteId,
    refetchInterval: query => (query.state.data?.endDate ? false : 3000),
  });
}

function Step({ n, title, done, children }) {
  return (
    <Column gap="3" className={styles.step} data-done={done ? 'true' : 'false'}>
      <Row gap="3" alignItems="center">
        <span className={styles.num} aria-hidden>
          {done ? '✓' : n}
        </span>
        <Heading size="sm">{title}</Heading>
      </Row>
      <Column gap="3" className={styles.body}>
        {children}
      </Column>
    </Column>
  );
}

/**
 * Shown on the dashboard while the user has no website: add one, copy its tag, and watch the first
 * event arrive. Replaces the four widgets that would otherwise have nothing to show.
 */
export function GullyOnboarding() {
  const [site, setSite] = useState<Site | null>(null);
  const [pinging, setPinging] = useState(false);
  const { toast } = useToast();
  const { touch } = useModified();
  const { data: range } = useFirstEvent(site?.id);
  const live = !!range?.endDate;

  const handleSave = async (website: Site) => {
    setSite(website);
    toast(`${website.name} added. Copy the tag below into your site.`);
  };

  // A pageview from this browser, the same call the tracker makes, so the check can go green
  // before the tag is on the site.
  const sendTestPing = async () => {
    if (!site) return;
    setPinging(true);
    try {
      const res = await fetch(`${process.env.basePath || ''}/api/send`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: 'event',
          payload: {
            website: site.id,
            hostname: site.domain,
            url: '/',
            title: `${BRAND.name} test ping`,
            language: navigator.language,
            screen: `${window.screen.width}x${window.screen.height}`,
            referrer: '',
          },
        }),
      });
      toast(res.ok ? 'Test ping sent. Waiting for it to arrive.' : 'The test ping was refused. Try again in a minute.');
    } catch {
      toast('The test ping could not be sent. Check your connection.');
    } finally {
      setPinging(false);
    }
  };

  const openDashboard = () => {
    touch('websites');
    touch('dashboard');
  };

  return (
    <Column className={styles.card} gap="6" data-test="gully-onboarding">
      <Column gap="2">
        <Heading size="lg">Add your first website</Heading>
        <Text color="muted">
          Your dashboard fills in as soon as one of your websites sends its first visit.
        </Text>
      </Column>

      <Step n={1} title="Name and domain" done={!!site}>
        {site ? (
          <Text>
            <strong>{site.name}</strong> <span className={styles.muted}>· {site.domain}</span>
          </Text>
        ) : (
          <WebsiteAddForm onSave={handleSave} closeOnSave={false} />
        )}
      </Step>

      <Step n={2} title="Copy the tracking tag" done={!!site && live}>
        {site ? (
          <WebsiteTrackingCode websiteId={site.id} showHeader={false} />
        ) : (
          <Text color="muted">Your tag appears here once the website is added.</Text>
        )}
      </Step>

      <Step n={3} title="Check the first event" done={live}>
        <Row gap="3" alignItems="center" wrap="wrap">
          <span
            className={styles.status}
            data-state={!site ? 'idle' : live ? 'live' : 'waiting'}
            role="status"
            data-test="gully-first-event"
          >
            <span className={styles.dot} aria-hidden />
            {!site ? 'Not started' : live ? 'First event received' : 'Waiting for the first event'}
          </span>
          {site && !live && (
            <Button onPress={sendTestPing} isDisabled={pinging} data-test="gully-test-ping">
              Send a test ping
            </Button>
          )}
          {live && (
            <Button variant="primary" onPress={openDashboard} data-test="gully-open-dashboard">
              Open my dashboard
            </Button>
          )}
        </Row>
      </Step>
    </Column>
  );
}
