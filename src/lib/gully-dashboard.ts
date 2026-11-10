/*
 * Gully Analytics: an empty-safe personal dashboard.
 *
 * A dashboard widget names one website, pixel or link. When that item is deleted or moves to an
 * account the user cannot read (a website transferred to another user, say), Umami showed
 * "Selected item is no longer available." in every widget. Here a widget whose item the user can no
 * longer read is bound to the user's own first website instead, or cleared when the user has none,
 * and a user without any widget gets a starter layout for that website. With no website at all the
 * dashboard shows the "Add your first website" card instead of widgets.
 */
import { v4 as uuid } from 'uuid';
import type { BoardEntityType } from './boards';
import type { BoardComponentConfig, BoardParameters } from './types';

export type CanView = (entityType: BoardEntityType, entityId: string) => boolean;

export interface RepairResult {
  parameters: BoardParameters;
  /** Widgets bound to another website. */
  rebound: number;
  /** Widgets cleared because the user has no website to bind them to. */
  cleared: number;
}

function componentEntity(c?: BoardComponentConfig | null) {
  if (!c) return null;
  if (c.entityType && c.entityId) return { entityType: c.entityType, entityId: c.entityId };
  if (c.websiteId) return { entityType: 'website' as const, entityId: c.websiteId };
  return null;
}

/** Ids per entity type that the dashboard's widgets reference. */
export function dashboardEntityIds(parameters?: BoardParameters) {
  const out = { website: new Set<string>(), pixel: new Set<string>(), link: new Set<string>() };
  for (const row of parameters?.rows ?? []) {
    for (const col of row.columns ?? []) {
      const e = componentEntity(col.component);
      if (e) out[e.entityType].add(e.entityId);
    }
  }
  return out;
}

export function hasDashboardComponents(parameters?: BoardParameters) {
  return (parameters?.rows ?? []).some(r => (r.columns ?? []).some(c => !!c.component));
}

/**
 * Rebinds or clears every widget whose item `canView` refuses. Pixel and link widgets cannot be
 * shown for a website, so they are cleared. A rebound widget loses its saved report (reports
 * belong to one website).
 */
export function repairDashboardParameters(
  parameters: BoardParameters | undefined,
  canView: CanView,
  fallbackWebsiteId?: string | null,
): RepairResult {
  let rebound = 0;
  let cleared = 0;
  if (!parameters?.rows) return { parameters: parameters ?? {}, rebound, cleared };

  const rows = parameters.rows.map(row => ({
    ...row,
    columns: (row.columns ?? []).map(col => {
      const e = componentEntity(col.component);
      if (!e || canView(e.entityType, e.entityId)) return col;
      if (e.entityType === 'website' && fallbackWebsiteId) {
        rebound++;
        const { websiteId: _w, props, ...rest } = col.component as BoardComponentConfig;
        const { reportId: _r, ...nextProps } = props ?? {};
        return {
          ...col,
          component: {
            ...rest,
            entityType: 'website' as const,
            entityId: fallbackWebsiteId,
            ...(Object.keys(nextProps).length ? { props: nextProps } : {}),
          },
        };
      }
      cleared++;
      return { ...col, component: null };
    }),
  }));

  if (!rebound && !cleared) return { parameters, rebound, cleared };
  return { parameters: { ...parameters, rows }, rebound, cleared };
}

const widget = (type: string, title: string, websiteId: string): BoardComponentConfig => ({
  type,
  title,
  description: '',
  entityType: 'website',
  entityId: websiteId,
});

/** The starter layout: metrics, visitors, world map and weekly traffic for one website. */
export function defaultDashboardParameters(websiteId: string): BoardParameters {
  return {
    rows: [
      {
        id: uuid(),
        size: 25,
        columns: [
          { id: uuid(), size: 50, component: widget('WebsiteMetricsBar', 'Metrics bar', websiteId) },
          { id: uuid(), size: 50, component: widget('WebsiteChart', 'Visitors chart', websiteId) },
        ],
      },
      {
        id: uuid(),
        size: 25,
        columns: [{ id: uuid(), size: 100, component: widget('WorldMap', 'World map', websiteId) }],
      },
      {
        id: uuid(),
        size: 25,
        columns: [
          { id: uuid(), size: 100, component: widget('WeeklyTraffic', 'Weekly traffic', websiteId) },
        ],
      },
    ],
  };
}

/** The tracking tag a website owner pastes into the page head. */
export function trackingSnippet(origin: string, websiteId: string, basePath = '') {
  const o = String(origin || '').replace(/\/+$/, '');
  return `<script defer src="${o}${basePath}/script.js" data-website-id="${websiteId}"></script>`;
}

/** Normalises a typed domain: no scheme, path, port (except localhost) or trailing dot. */
export function cleanDomain(value: string) {
  let d = String(value ?? '')
    .trim()
    .toLowerCase();
  d = d
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
    .replace(/[/?#].*$/, '')
    .replace(/\.$/, '');
  if (!d.startsWith('localhost')) d = d.replace(/:\d+$/, '');
  return d;
}
