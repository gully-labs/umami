'use client';
import { Code, Column, Grid, Heading, ProgressBar, Row, Text } from '@umami/react-zen';
import { WebsiteControls } from '@/app/(main)/websites/[websiteId]/WebsiteControls';
import { PieChart } from '@/components/charts/PieChart';
import { Empty } from '@/components/common/Empty';
import { LoadingPanel } from '@/components/common/LoadingPanel';
import { Panel } from '@/components/common/Panel';
import { useMessages } from '@/components/hooks';
import { useWeb3MetricsQuery } from '@/components/hooks/queries/useWeb3MetricsQuery';
import { ListTable } from '@/components/metrics/ListTable';
import { MetricCard } from '@/components/metrics/MetricCard';
import { MetricsBar } from '@/components/metrics/MetricsBar';
import { CHART_COLORS } from '@/lib/constants';
import { formatLongNumber } from '@/lib/format';
import { getChainName, getWalletName, ratio } from '@/lib/web3';
import type { Web3Metrics } from '@/queries/sql/web3/getWeb3Metrics';

type Summary = Web3Metrics['summary'];

const percent = (value: number | null) => (value === null ? '-' : `${(value * 100).toFixed(1)}%`);

export function Web3Page({ websiteId }: { websiteId: string }) {
  const { getErrorMessage } = useMessages();
  const { data, isLoading, isFetching, error } = useWeb3MetricsQuery({ websiteId });
  const summary = data?.summary;
  const hasActivity =
    !!summary &&
    summary.connects + summary.transactions + summary.chainSwitches + summary.disconnects > 0;

  return (
    <Column gap="3">
      <WebsiteControls websiteId={websiteId} />
      <LoadingPanel
        data={data}
        isLoading={isLoading}
        isFetching={isFetching}
        error={getErrorMessage(error)}
        minHeight="136px"
      >
        {summary && <Web3MetricsBar summary={summary} />}
      </LoadingPanel>
      {data && !hasActivity && <Web3SetupHint />}
      {data && hasActivity && (
        <>
          <Web3Funnel summary={data.summary} />
          <Grid columns={{ base: '1fr', lg: '1fr 1fr' }} gap="3">
            <ChainsPanel chains={data.chains} />
            <WalletAppsPanel walletApps={data.walletApps} />
          </Grid>
          <Panel>
            {data.pages.length ? (
              <ListTable
                title="Top pages by wallet connects"
                metric="Connects"
                data={withPercent(
                  data.pages.map(({ path, connects }) => ({ label: path, count: connects })),
                )}
              />
            ) : (
              <>
                <Text weight="bold">Top pages by wallet connects</Text>
                <Empty />
              </>
            )}
          </Panel>
        </>
      )}
    </Column>
  );
}

function withPercent(rows: { label: string; count: number }[]) {
  const total = rows.reduce((sum, { count }) => sum + count, 0);
  return rows.map(row => ({ ...row, percent: total ? (row.count / total) * 100 : 0 }));
}

function Web3MetricsBar({ summary }: { summary: Summary }) {
  const { wallets, connects, transactions, sessions, connectedSessions } = summary;
  const connectRate = ratio(connectedSessions, sessions);
  const txPerWallet = ratio(transactions, wallets);

  return (
    <MetricsBar>
      <MetricCard
        label="Unique wallets"
        value={wallets}
        formatValue={formatLongNumber}
        tooltip="Distinct wallet addresses (or address hashes) seen on connects and transactions"
      />
      <MetricCard label="Wallet connects" value={connects} formatValue={formatLongNumber} />
      <MetricCard
        label="Connect rate"
        value={connectRate ?? 0}
        formatValue={n => (connectRate === null ? '-' : percent(n))}
        tooltip="Sessions with a connected wallet divided by all sessions"
      />
      <MetricCard label="Transactions" value={transactions} formatValue={formatLongNumber} />
      <MetricCard
        label="Tx per wallet"
        value={txPerWallet ?? 0}
        formatValue={n => (txPerWallet === null ? '-' : Number(n).toFixed(2))}
      />
    </MetricsBar>
  );
}

function Web3Funnel({ summary }: { summary: Summary }) {
  const steps = [
    { label: 'Visited', value: summary.sessions },
    { label: 'Connected a wallet', value: summary.connectedSessions },
    { label: 'Sent a transaction', value: summary.txSessions },
  ];
  const first = steps[0].value;

  return (
    <Panel title="Funnel" description="Sessions in the selected period">
      <Column gap="5">
        {steps.map(({ label, value }, index) => (
          <Column key={label} gap="2">
            <Row justifyContent="space-between" alignItems="baseline" gap wrap="wrap">
              <Text weight="bold">{`${index + 1}. ${label}`}</Text>
              <Row gap="3" alignItems="baseline">
                <Text color="muted">{`${formatLongNumber(value)} ${value === 1 ? 'session' : 'sessions'}`}</Text>
                <Text weight="bold" size="xl">
                  {percent(ratio(value, first))}
                </Text>
              </Row>
            </Row>
            <ProgressBar value={value} min={0} max={first || 1} style={{ width: '100%' }} />
          </Column>
        ))}
      </Column>
    </Panel>
  );
}

function BreakdownTable({ headers, rows }: { headers: string[]; rows: (string | number)[][] }) {
  const columns = `minmax(0, 1fr) ${headers
    .slice(1)
    .map(() => 'minmax(56px, auto)')
    .join(' ')}`;

  return (
    <Column gap="2">
      <Grid columns={columns} gap="3">
        {headers.map((header, i) => (
          <Text key={header} weight="bold" align={i ? 'right' : undefined}>
            {header}
          </Text>
        ))}
      </Grid>
      {rows.map(row => (
        <Grid key={String(row[0])} columns={columns} gap="3" alignItems="center">
          {row.map((cell, i) => (
            <Text
              key={i}
              align={i ? 'right' : undefined}
              truncate={!i}
              title={typeof cell === 'string' ? cell : undefined}
            >
              {typeof cell === 'number' ? formatLongNumber(cell) : cell}
            </Text>
          ))}
        </Grid>
      ))}
    </Column>
  );
}

function doughnut(labels: string[], values: number[]) {
  return {
    labels,
    datasets: [{ data: values, backgroundColor: CHART_COLORS, borderWidth: 0 }],
  };
}

function ChainsPanel({ chains }: { chains: Web3Metrics['chains'] }) {
  return (
    <Panel title="Chains">
      {chains.length ? (
        <>
          <PieChart
            type="doughnut"
            height="220px"
            chartData={doughnut(
              chains.map(({ chainId }) => getChainName(chainId)),
              chains.map(
                ({ connects, switches, transactions }) => connects + switches + transactions,
              ),
            )}
          />
          <BreakdownTable
            headers={['Chain', 'Connects', 'Switches', 'Txs']}
            rows={chains.map(({ chainId, connects, switches, transactions }) => [
              `${getChainName(chainId)} (${chainId})`,
              connects,
              switches,
              transactions,
            ])}
          />
        </>
      ) : (
        <Empty />
      )}
    </Panel>
  );
}

function WalletAppsPanel({ walletApps }: { walletApps: Web3Metrics['walletApps'] }) {
  return (
    <Panel title="Wallet apps">
      {walletApps.length ? (
        <>
          <PieChart
            type="doughnut"
            height="220px"
            chartData={doughnut(
              walletApps.map(({ wallet }) => getWalletName(wallet)),
              walletApps.map(({ connects }) => connects),
            )}
          />
          <BreakdownTable
            headers={['Wallet', 'Connects', 'Wallets']}
            rows={walletApps.map(({ wallet, connects, wallets }) => [
              getWalletName(wallet),
              connects,
              wallets,
            ])}
          />
        </>
      ) : (
        <Empty />
      )}
    </Panel>
  );
}

function Web3SetupHint() {
  return (
    <Panel>
      <Column gap="3" alignItems="flex-start">
        <Heading size="lg">No wallet activity in this period</Heading>
        <Text color="muted">
          Web3 tracking is opt-in. Add data-web3="true" to the tracking script on your dapp to
          record wallet connects, chain switches and transactions. Addresses are hashed by default.
        </Text>
        <Code>{`<script defer src="https://analytics.example.com/script.js" data-website-id="..." data-web3="true"></script>`}</Code>
      </Column>
    </Panel>
  );
}
