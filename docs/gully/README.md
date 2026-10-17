# Gully Analytics

Gully Analytics is privacy-friendly web analytics with Web3 tracking for dapps, by
[Gully Labs](https://gullylabs.xyz). It is a fork of [Umami](https://github.com/umami-software/umami)
(MIT, Copyright (c) Umami Software, Inc.). Gully's changes are MIT licensed as well.

Everything Umami does still works. On top of it Gully adds:

- **Web3 tracking** in the tracker script (opt-in): wallet connects and disconnects, chain switches
  and transactions sent, with hashed wallet addresses by default.
- **A Web3 dashboard** per website (sidebar: Traffic → Web3): unique wallets, connects, connect
  rate, transactions, tx per wallet, a visit → connect → transaction funnel, a chains breakdown,
  a wallet apps breakdown and the top pages by wallet connects.
- The Gully Labs look: dark theme by default, gold accent, Barlow Condensed, Hanken Grotesk and
  IBM Plex Mono.

## Install the tracker

```html
<script
  defer
  src="https://analytics.gullylabs.xyz/script.js"
  data-website-id="YOUR-WEBSITE-ID"
  data-web3="true"
></script>
```

Without `data-web3="true"` the script behaves exactly like the Umami tracker. All the usual
Umami attributes (`data-domains`, `data-do-not-track`, `data-tag`, `data-before-send`, ...) still
apply, and Web3 events respect them.

### Privacy modes

`data-web3-address` controls what is stored about the wallet address:

| Value            | Stored as                                                                 |
| ---------------- | ------------------------------------------------------------------------- |
| `hash` (default) | first 16 hex chars of SHA-256 of the lowercase address. Unique wallets can be counted, the address can't be read back. |
| `full`           | the lowercase address.                                                    |
| `none`           | nothing. Unique wallets and tx per wallet will show 0 / `-`.              |

```html
<script defer src=".../script.js" data-website-id="..." data-web3="true" data-web3-address="none"></script>
```

Hashing uses `crypto.subtle`, which browsers only expose on HTTPS (and `localhost`). On plain
HTTP the address is dropped rather than sent in clear.

Note that a 16-hex-char hash of a public address is pseudonymous, not anonymous: anyone holding a
candidate address can hash it and compare. Use `none` if that matters for your users.

### What the script does (and doesn't)

- Finds wallets through EIP-6963 (`eip6963:announceProvider`, it dispatches
  `eip6963:requestProvider` once) and `window.ethereum`.
- Wraps each provider's `request` function to watch what the dapp asks for and what the wallet
  answers, and listens to `accountsChanged` / `chainChanged`. The original promise is returned
  untouched, errors pass through, and tracking failures never reach the dapp.
- It **never calls a wallet method itself**, so it can't trigger a wallet prompt.
- Only the dapp's own `provider.request(...)` calls are seen. Legacy `send` / `sendAsync` calls and
  wallets whose provider object is frozen are observed through events only (no tx events).

The Web3 code adds about 2.4 KB to `script.js` (about 1 KB gzipped).

## Event schema

All events are standard Umami custom events (`event_type = 2`) with event data, so they also show
up under Events and can be used in Goals, Funnels and filters.

| Event               | When                                                                                       | Event data |
| ------------------- | ------------------------------------------------------------------------------------------ | ---------- |
| `wallet-connect`    | `eth_requestAccounts` resolves with an account not already reported on this page, or the user switches account in the wallet | `address`, `chainId`, `wallet` |
| `wallet-disconnect` | `accountsChanged` with no accounts after a connect                                          | `wallet` |
| `chain-switch`      | `wallet_switchEthereumChain` succeeds, or `chainChanged` moves away from a known chain      | `chainId` |
| `tx-sent`           | `eth_sendTransaction` / `eth_sendRawTransaction` returns a hash                             | `hash`, `chainId`, `to`, `address` |

- `address`: per the privacy mode (hash by default). Omitted in `none` mode.
- `chainId`: decimal number (`8453`), converted from the wallet's hex value.
- `wallet`: the EIP-6963 `rdns` (`io.metamask`, `io.rabby`, `com.coinbase.wallet`, ...), else the
  wallet name, else a guess from injected flags (`isRabby`, `isMetaMask`, ...).
- `to`: lowercase recipient for `eth_sendTransaction`. Not available for raw transactions.

`wallet-connect` is sent 300 ms after the accounts arrive so the dapp's follow-up `eth_chainId`
call can supply the chain. Silent reconnects (`eth_accounts` on page load) are not counted as
connects.

You can also send these events yourself with `umami.track('tx-sent', { hash, chainId, ... })`
(for example from a backend-relayed or account-abstraction flow); the dashboard reads them the same.

## Web3 dashboard

`Websites → (site) → Web3`, or `GET /api/websites/{websiteId}/web3?startAt=...&endAt=...` (same
auth and filters as the other website endpoints).

- **Unique wallets**: distinct `address` values on `wallet-connect` and `tx-sent`.
- **Connect rate**: sessions with a `wallet-connect` or `tx-sent` / all sessions in the range.
- **Tx per wallet**: `tx-sent` events / unique wallets.
- **Funnel**: sessions → sessions that connected a wallet → sessions that sent a transaction.
- **Chains**: connects, switches and transactions per `chainId`. Named chains: Ethereum (1),
  Optimism (10), BNB Chain (56), Polygon (137), HyperEVM (999), Robinhood Chain (4663), Arc (5042),
  Base (8453), Arbitrum (42161). Others show as `Chain <id>`.
- **Wallet apps**: connects per `wallet`, with friendly names for common rdns ids.
- **Top pages by connects**: URL path of each `wallet-connect`.

The Web3 dashboard runs on PostgreSQL. On a ClickHouse backend the endpoint answers
`501 not-implemented` (the tracker still records the events; only the dashboard queries are missing).

## Self-hosting with Docker Compose

```bash
git clone https://github.com/gully-labs/umami.git gully-analytics
cd gully-analytics
cp .env.gully.example .env.gully   # set POSTGRES_PASSWORD, APP_SECRET, TWO_FACTOR_ENCRYPTION_KEY
docker compose -f docker-compose.gully.yml --env-file .env.gully up -d --build
```

- The image is built from this repo's `Dockerfile` (the upstream one, unchanged). The build needs
  internet access (npm packages and Google Fonts) and about 4 GB of RAM.
- The app binds to `127.0.0.1:3000`. Put a TLS proxy in front, e.g. Caddy:

  ```
  analytics.gullylabs.xyz {
    reverse_proxy 127.0.0.1:3000
  }
  ```

- DNS: an `A` (or proxied `CNAME`) record for `analytics.gullylabs.xyz` pointing at the host.
- First login: `admin` / `umami`. Change the password immediately (Settings → Profile).
- Data lives in the `gully-analytics-db` volume. Back it up with
  `docker compose -f docker-compose.gully.yml exec db pg_dump -U gully gully_analytics > backup.sql`.
- Telemetry and update checks to Umami's servers are turned off (`DISABLE_TELEMETRY`,
  `DISABLE_UPDATES`).

## Development

```bash
pnpm install
echo "DATABASE_URL=postgresql://user:pass@localhost:5432/umami" > .env
echo "APP_SECRET=dev" >> .env
pnpm build:tracker      # public/script.js
pnpm vitest run src/tracker src/lib/web3.test.ts
pnpm dev
```

Gully-specific code lives in:

- `src/tracker/web3.ts` (+ `web3.test.ts`): tracker Web3 module, wired in `src/tracker/index.ts`.
- `src/lib/web3.ts`, `src/lib/brand.ts`: chain and wallet names, product branding.
- `src/queries/sql/web3/getWeb3Metrics.ts`, `src/app/api/websites/[websiteId]/web3/`: API.
- `src/app/(main)/websites/[websiteId]/web3/`: dashboard page.
- `src/app/global.css`, `src/app/layout.tsx`, `src/app/Providers.tsx`: theme, fonts, default dark.

Upstream merges: keep Gully changes in these files where possible; branding goes through
`BRAND` in `src/lib/brand.ts`.
