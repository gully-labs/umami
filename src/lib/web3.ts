/* Gully Analytics: shared Web3 constants and helpers (server and client). */

export const WEB3_EVENTS = {
  connect: 'wallet-connect',
  disconnect: 'wallet-disconnect',
  chainSwitch: 'chain-switch',
  txSent: 'tx-sent',
} as const;

export const WEB3_EVENT_NAMES: string[] = Object.values(WEB3_EVENTS);

export const CHAIN_NAMES: Record<string, string> = {
  '1': 'Ethereum',
  '10': 'Optimism',
  '56': 'BNB Chain',
  '137': 'Polygon',
  '999': 'HyperEVM',
  '4663': 'Robinhood Chain',
  '5042': 'Arc',
  '8453': 'Base',
  '42161': 'Arbitrum',
};

export const WALLET_NAMES: Record<string, string> = {
  'io.metamask': 'MetaMask',
  'io.metamask.flask': 'MetaMask Flask',
  'io.rabby': 'Rabby',
  'com.coinbase.wallet': 'Coinbase Wallet',
  'com.brave.wallet': 'Brave Wallet',
  'app.phantom': 'Phantom',
  'com.trustwallet.app': 'Trust Wallet',
  'com.okex.wallet': 'OKX Wallet',
  'io.zerion.wallet': 'Zerion',
  'me.rainbow': 'Rainbow',
  'com.bitget.web3': 'Bitget Wallet',
  'io.xdefi': 'XDEFI',
  'app.backpack': 'Backpack',
};

export function getChainName(chainId?: string | number | null): string {
  if (chainId === null || chainId === undefined || chainId === '') {
    return 'Unknown chain';
  }
  const id = String(chainId);
  return CHAIN_NAMES[id] ?? `Chain ${id}`;
}

export function getWalletName(wallet?: string | null): string {
  if (!wallet) {
    return 'Unknown wallet';
  }
  return WALLET_NAMES[wallet] ?? wallet;
}

/** Safe ratio for display; null when the denominator is zero. */
export function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}
