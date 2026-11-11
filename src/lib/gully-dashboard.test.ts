import { describe, expect, test } from 'vitest';
import {
  cleanDomain,
  dashboardEntityIds,
  defaultDashboardParameters,
  hasDashboardComponents,
  repairDashboardParameters,
  trackingSnippet,
} from './gully-dashboard';

const GONE = '78f29233-9f70-4c45-a440-35d1457d2207';
const MINE = '11111111-2222-4333-8444-555555555555';

// The dashboard from the owner's report: four widgets on a website moved to another account.
const brokenDashboard = () => ({
  rows: [
    {
      id: 'r1',
      size: 25,
      columns: [
        {
          id: 'c1',
          size: 50,
          component: {
            type: 'WebsiteMetricsBar',
            title: 'Metrics bar',
            entityId: GONE,
            entityType: 'website' as const,
          },
        },
        {
          id: 'c2',
          size: 50,
          component: {
            type: 'WebsiteChart',
            title: 'Visitors chart',
            entityId: GONE,
            entityType: 'website' as const,
          },
        },
      ],
    },
    {
      id: 'r2',
      size: 25,
      columns: [
        {
          id: 'c3',
          size: 100,
          component: { type: 'WorldMap', entityId: GONE, entityType: 'website' as const },
        },
      ],
    },
    {
      id: 'r3',
      size: 25,
      columns: [
        {
          id: 'c4',
          size: 100,
          component: { type: 'Funnel', websiteId: GONE, props: { reportId: 'x', limit: 5 } },
        },
      ],
    },
  ],
});

describe('repairDashboardParameters', () => {
  test('rebinds widgets the user cannot read to the user own website', () => {
    const { parameters, rebound, cleared } = repairDashboardParameters(
      brokenDashboard(),
      () => false,
      MINE,
    );
    expect(rebound).toBe(4);
    expect(cleared).toBe(0);
    const ids = dashboardEntityIds(parameters);
    expect([...ids.website]).toEqual([MINE]);
    const funnel = parameters.rows[2].columns[0].component;
    expect(funnel.websiteId).toBeUndefined();
    expect(funnel.props).toEqual({ limit: 5 });
    expect(parameters.rows[0].columns[0].component.title).toBe('Metrics bar');
  });

  test('clears widgets when the user has no website, so the onboarding card shows', () => {
    const { parameters, cleared } = repairDashboardParameters(brokenDashboard(), () => false, null);
    expect(cleared).toBe(4);
    expect(hasDashboardComponents(parameters)).toBe(false);
    expect(parameters.rows).toHaveLength(3);
  });

  test('keeps widgets the user can read untouched', () => {
    const input = brokenDashboard();
    const result = repairDashboardParameters(input, () => true, MINE);
    expect(result.parameters).toBe(input);
    expect(result.rebound + result.cleared).toBe(0);
  });

  test('clears pixel and link widgets that are gone instead of binding them to a website', () => {
    const input = {
      rows: [
        {
          id: 'r',
          columns: [
            {
              id: 'c',
              component: { type: 'PixelChart', entityType: 'pixel' as const, entityId: GONE },
            },
          ],
        },
      ],
    };
    const { parameters, cleared } = repairDashboardParameters(input, () => false, MINE);
    expect(cleared).toBe(1);
    expect(parameters.rows[0].columns[0].component).toBeNull();
  });

  test('handles a missing or empty board', () => {
    expect(repairDashboardParameters(undefined, () => false, MINE).parameters).toEqual({});
    expect(hasDashboardComponents(undefined)).toBe(false);
  });
});

describe('defaultDashboardParameters', () => {
  test('binds the four starter widgets to one website', () => {
    const p = defaultDashboardParameters(MINE);
    expect(hasDashboardComponents(p)).toBe(true);
    const types = p.rows.flatMap(r => r.columns.map(c => c.component.type));
    expect(types).toEqual(['WebsiteMetricsBar', 'WebsiteChart', 'WorldMap', 'WeeklyTraffic']);
    expect([...dashboardEntityIds(p).website]).toEqual([MINE]);
  });
});

describe('snippet and domain', () => {
  test('builds the tracking tag', () => {
    expect(trackingSnippet('https://analytics.gullylabs.xyz/', MINE)).toBe(
      `<script defer src="https://analytics.gullylabs.xyz/script.js" data-website-id="${MINE}"></script>`,
    );
  });

  test('cleans typed domains', () => {
    expect(cleanDomain(' HTTPS://Example.com/path?q=1 ')).toBe('example.com');
    expect(cleanDomain('app.example.com:8080')).toBe('app.example.com');
    expect(cleanDomain('localhost:3000')).toBe('localhost:3000');
  });
});
