/*
 * Gully Analytics: opt-in Web3 tracking for the browser tracker.
 *
 * Observes EIP-1193 wallets (EIP-6963 announcements and window.ethereum) without ever calling a
 * wallet method itself. It wraps `provider.request` so it can see what the dapp asks for and what
 * the wallet answers, and listens to `accountsChanged` / `chainChanged`.
 *
 * Events: wallet-connect, wallet-disconnect, chain-switch, tx-sent.
 */

export type AddressMode = 'full' | 'hash' | 'none';

export type Web3EventData = Record<string, string | number>;

export type Web3Track = (name: string, data: Web3EventData) => unknown;

export interface Eip1193Provider {
  request: (args: { method: string; params?: unknown }) => Promise<unknown>;
  on?: (event: string, listener: (...args: any[]) => void) => unknown;
  chainId?: unknown;
  [flag: string]: unknown;
}

interface ProviderInfo {
  rdns?: string;
  name?: string;
}

/** Normalizes a chain id (hex string, decimal string or number) to a positive integer. */
export const toChainId = (value: unknown): number | undefined => {
  const n =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value
        ? Number(/^0x/i.test(value) ? parseInt(value, 16) : value)
        : NaN;
  return n > 0 && Number.isSafeInteger(n) ? n : undefined;
};

const isAddress = (value: unknown): value is string =>
  typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value);

/** SHA-256 of the lowercase address, first 16 hex characters. */
export const hashAddress = async (address: string): Promise<string> => {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(address.toLowerCase()),
  );
  return Array.from(new Uint8Array(digest).slice(0, 8), b => b.toString(16).padStart(2, '0')).join(
    '',
  );
};

/**
 * Applies the privacy mode to an address. Returns undefined when the address must not be sent
 * (mode `none`, invalid address, or hashing unavailable outside a secure context).
 */
export const formatAddress = async (
  address: unknown,
  mode: AddressMode,
): Promise<string | undefined> => {
  if (!isAddress(address) || mode === 'none') return undefined;
  if (mode === 'full') return address.toLowerCase();
  try {
    return await hashAddress(address);
  } catch {
    return undefined;
  }
};

export const parseAddressMode = (value: string | null): AddressMode =>
  value === 'full' || value === 'none' ? value : 'hash';

/** Drops empty fields so event data only carries what is known. */
export const shapeEventData = (data: Record<string, unknown>): Web3EventData => {
  const out: Web3EventData = {};
  for (const key in data) {
    const value = data[key];
    if (
      (typeof value === 'string' && value) ||
      (typeof value === 'number' && !Number.isNaN(value))
    ) {
      out[key] = value;
    }
  }
  return out;
};

const WALLET_FLAGS: [string, string][] = [
  ['isRabby', 'io.rabby'],
  ['isCoinbaseWallet', 'com.coinbase.wallet'],
  ['isBraveWallet', 'com.brave.wallet'],
  ['isMetaMask', 'io.metamask'],
];

/** Best-effort wallet id for a provider without EIP-6963 info. */
export const detectWallet = (provider: Eip1193Provider): string | undefined =>
  WALLET_FLAGS.find(([flag]) => provider[flag])?.[1];

export const initWeb3 = (
  win: Window & { ethereum?: Eip1193Provider },
  track: Web3Track,
  mode: AddressMode,
  delay = 300,
) => {
  const seen = new WeakSet<object>();
  let connected: string | undefined;
  let chain: number | undefined;
  let lastWallet: string | undefined;

  let queue: Promise<unknown> = Promise.resolve();

  // Serialized so events keep their order even though hashing is async.
  const emit = (name: string, data: Record<string, unknown>) => {
    const { address, ...rest } = data;
    queue = queue
      .then(() => formatAddress(address, mode))
      .then(hashed => track(name, shapeEventData({ ...rest, address: hashed })))
      .catch(() => {});
  };

  const connect = (address: unknown, wallet: string | undefined, provider: Eip1193Provider) => {
    if (!isAddress(address) || address.toLowerCase() === connected) return;
    connected = address.toLowerCase();
    // Let the dapp's follow-up eth_chainId resolve before reporting the chain.
    setTimeout(
      () =>
        emit('wallet-connect', { address, chainId: chain || toChainId(provider.chainId), wallet }),
      delay,
    );
  };

  const setChain = (value: unknown, report: boolean) => {
    const id = toChainId(value);
    if (!id || id === chain) return;
    const known = chain;
    chain = id;
    if (report || known) emit('chain-switch', { chainId: id });
  };

  const observe = (
    provider: Eip1193Provider,
    wallet: string | undefined,
    method: string,
    params: any,
    result: unknown,
  ) => {
    switch (method) {
      case 'eth_requestAccounts':
        lastWallet = wallet;
        return Array.isArray(result) && connect(result[0], wallet, provider);
      case 'eth_chainId':
        return setChain(result, false);
      case 'wallet_switchEthereumChain':
        return setChain(params?.[0]?.chainId, true);
      case 'eth_sendTransaction':
      case 'eth_sendRawTransaction': {
        const tx = method === 'eth_sendTransaction' ? params?.[0] || {} : {};
        if (typeof result === 'string') {
          emit('tx-sent', {
            hash: result,
            chainId: chain || toChainId(tx.chainId) || toChainId(provider.chainId),
            to: isAddress(tx.to) ? tx.to.toLowerCase() : undefined,
            address: tx.from || connected,
          });
        }
      }
    }
  };

  const wrap = (provider: Eip1193Provider | undefined, info?: ProviderInfo) => {
    if (!provider || typeof provider.request !== 'function' || seen.has(provider)) return;
    seen.add(provider);
    const wallet = info?.rdns || info?.name || detectWallet(provider);
    const request = provider.request;

    try {
      provider.request = function (this: unknown, args) {
        const promise = request.call(this ?? provider, args);
        Promise.resolve(promise).then(
          result => {
            try {
              observe(provider, wallet, args?.method, args?.params, result);
            } catch {
              /* never break the dapp */
            }
          },
          () => {},
        );
        return promise;
      };
    } catch {
      /* frozen provider: events only */
    }

    try {
      provider.on?.('accountsChanged', (accounts: unknown) => {
        const next = Array.isArray(accounts) ? accounts[0] : undefined;
        if (!next) {
          if (connected) {
            connected = undefined;
            emit('wallet-disconnect', { wallet: lastWallet || wallet });
          }
        } else if (connected) {
          connect(next, wallet, provider);
        }
      });
      provider.on?.('chainChanged', (id: unknown) => setChain(id, false));
    } catch {
      /* ignore */
    }
  };

  win.addEventListener('eip6963:announceProvider', (event: Event) => {
    const detail = (event as CustomEvent).detail;
    wrap(detail?.provider, detail?.info);
  });
  win.dispatchEvent(new Event('eip6963:requestProvider'));

  wrap(win.ethereum);
  win.addEventListener('ethereum#initialized', () => wrap(win.ethereum), { once: true });
};
