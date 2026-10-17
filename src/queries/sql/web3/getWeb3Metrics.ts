/* Gully Analytics: Web3 dashboard metrics built from wallet events and their event data. */
import { CLICKHOUSE, PRISMA, runQuery } from '@/lib/db';
import prisma from '@/lib/prisma';
import type { QueryFilters } from '@/lib/types';
import { WEB3_EVENT_NAMES, WEB3_EVENTS } from '@/lib/web3';

const FUNCTION_NAME = 'getWeb3Metrics';

export class Web3UnsupportedError extends Error {}

export interface Web3Summary {
  sessions: number;
  connectedSessions: number;
  txSessions: number;
  wallets: number;
  connects: number;
  disconnects: number;
  chainSwitches: number;
  transactions: number;
}

export interface Web3ChainRow {
  chainId: string;
  connects: number;
  switches: number;
  transactions: number;
  wallets: number;
}

export interface Web3WalletRow {
  wallet: string | null;
  connects: number;
  wallets: number;
  sessions: number;
}

export interface Web3PageRow {
  path: string;
  connects: number;
}

export interface Web3Metrics {
  summary: Web3Summary;
  chains: Web3ChainRow[];
  walletApps: Web3WalletRow[];
  pages: Web3PageRow[];
}

export async function getWeb3Metrics(
  ...args: [websiteId: string, filters: QueryFilters]
): Promise<Web3Metrics> {
  return runQuery({
    [PRISMA]: () => relationalQuery(...args),
    [CLICKHOUSE]: () => {
      throw new Web3UnsupportedError(
        'Web3 analytics is not supported on ClickHouse yet. Use the PostgreSQL backend.',
      );
    },
  });
}

const EVENT_LIST = WEB3_EVENT_NAMES.map(name => `'${name}'`).join(', ');
const { connect, disconnect, chainSwitch, txSent } = WEB3_EVENTS;

const toNumber = (value: unknown) => Number(value ?? 0);

async function relationalQuery(websiteId: string, filters: QueryFilters): Promise<Web3Metrics> {
  const { parseFilters, rawQuery } = prisma;
  const { filterQuery, joinSessionQuery, cohortQuery, queryParams } = parseFilters({
    ...filters,
    websiteId,
  });

  const baseWhere = `
    where website_event.website_id = {{websiteId::uuid}}
      and website_event.created_at between {{startDate}} and {{endDate}}
      ${filterQuery}`;

  // One row per wallet event with its address / chainId / wallet properties pivoted out.
  const walletEvents = `
    with ev as (
      select website_event.event_id,
        website_event.session_id,
        website_event.event_name,
        website_event.url_path
      from website_event
      ${cohortQuery}
      ${joinSessionQuery}
      ${baseWhere}
        and website_event.event_type = 2
        and website_event.event_name in (${EVENT_LIST})
    ),
    d as (
      select ev.event_id,
        ev.session_id,
        ev.event_name,
        ev.url_path,
        max(case when ed.data_key = 'address' then ed.string_value end) as address,
        max(case when ed.data_key = 'chainId' then
          case when ed.data_type = 2 then cast(cast(trunc(ed.number_value) as bigint) as varchar)
               else ed.string_value end
        end) as chain_id,
        max(case when ed.data_key = 'wallet' then ed.string_value end) as wallet
      from ev
      left join event_data ed
        on ed.website_event_id = ev.event_id
        and ed.website_id = {{websiteId::uuid}}
        and ed.data_key in ('address', 'chainId', 'wallet')
      group by ev.event_id, ev.session_id, ev.event_name, ev.url_path
    )`;

  const [sessions, summary, chains, walletApps, pages] = await Promise.all([
    rawQuery(
      `
      select count(distinct website_event.session_id) as "sessions"
      from website_event
      ${cohortQuery}
      ${joinSessionQuery}
      ${baseWhere}
      `,
      queryParams,
      FUNCTION_NAME,
    ),
    rawQuery(
      `${walletEvents}
      select
        count(*) filter (where event_name = '${connect}') as "connects",
        count(*) filter (where event_name = '${disconnect}') as "disconnects",
        count(*) filter (where event_name = '${chainSwitch}') as "chainSwitches",
        count(*) filter (where event_name = '${txSent}') as "transactions",
        count(distinct address) as "wallets",
        count(distinct session_id) filter (where event_name in ('${connect}', '${txSent}')) as "connectedSessions",
        count(distinct session_id) filter (where event_name = '${txSent}') as "txSessions"
      from d
      `,
      queryParams,
      FUNCTION_NAME,
    ),
    rawQuery(
      `${walletEvents}
      select chain_id as "chainId",
        count(*) filter (where event_name = '${connect}') as "connects",
        count(*) filter (where event_name = '${chainSwitch}') as "switches",
        count(*) filter (where event_name = '${txSent}') as "transactions",
        count(distinct address) as "wallets"
      from d
      where chain_id is not null
      group by chain_id
      order by 4 desc, 2 desc, 3 desc
      limit 50
      `,
      queryParams,
      FUNCTION_NAME,
    ),
    rawQuery(
      `${walletEvents}
      select wallet as "wallet",
        count(*) as "connects",
        count(distinct address) as "wallets",
        count(distinct session_id) as "sessions"
      from d
      where event_name = '${connect}'
      group by wallet
      order by 2 desc
      limit 50
      `,
      queryParams,
      FUNCTION_NAME,
    ),
    rawQuery(
      `${walletEvents}
      select url_path as "path",
        count(*) as "connects"
      from d
      where event_name = '${connect}'
      group by url_path
      order by 2 desc
      limit 20
      `,
      queryParams,
      FUNCTION_NAME,
    ),
  ]);

  const s = summary?.[0] ?? {};

  return {
    summary: {
      sessions: toNumber(sessions?.[0]?.sessions),
      connectedSessions: toNumber(s.connectedSessions),
      txSessions: toNumber(s.txSessions),
      wallets: toNumber(s.wallets),
      connects: toNumber(s.connects),
      disconnects: toNumber(s.disconnects),
      chainSwitches: toNumber(s.chainSwitches),
      transactions: toNumber(s.transactions),
    },
    chains: (chains ?? []).map((row: any) => ({
      chainId: String(row.chainId),
      connects: toNumber(row.connects),
      switches: toNumber(row.switches),
      transactions: toNumber(row.transactions),
      wallets: toNumber(row.wallets),
    })),
    walletApps: (walletApps ?? []).map((row: any) => ({
      wallet: row.wallet ?? null,
      connects: toNumber(row.connects),
      wallets: toNumber(row.wallets),
      sessions: toNumber(row.sessions),
    })),
    pages: (pages ?? []).map((row: any) => ({
      path: row.path,
      connects: toNumber(row.connects),
    })),
  };
}
