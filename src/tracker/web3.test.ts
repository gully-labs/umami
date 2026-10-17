import { createHash } from 'node:crypto';
import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  detectWallet,
  type Eip1193Provider,
  formatAddress,
  hashAddress,
  initWeb3,
  parseAddressMode,
  shapeEventData,
  toChainId,
} from './web3';

const ADDRESS = '0xAbCdEf0123456789aBcDeF0123456789AbCdEf01';
const OTHER = '0x1111111111111111111111111111111111111111';
const TX = `0x${'ab'.repeat(32)}`;
const expectedHash = (a: string) =>
  createHash('sha256').update(a.toLowerCase()).digest('hex').slice(0, 16);

describe('address privacy', () => {
  test('hashAddress is sha-256 of the lowercase address, first 16 hex chars', async () => {
    const hash = await hashAddress(ADDRESS);
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
    expect(hash).toBe(expectedHash(ADDRESS));
    expect(await hashAddress(ADDRESS.toLowerCase())).toBe(hash);
  });

  test('formatAddress applies the mode', async () => {
    expect(await formatAddress(ADDRESS, 'hash')).toBe(expectedHash(ADDRESS));
    expect(await formatAddress(ADDRESS, 'full')).toBe(ADDRESS.toLowerCase());
    expect(await formatAddress(ADDRESS, 'none')).toBeUndefined();
    expect(await formatAddress('not-an-address', 'full')).toBeUndefined();
    expect(await formatAddress(undefined, 'hash')).toBeUndefined();
  });

  test('parseAddressMode defaults to hash', () => {
    expect(parseAddressMode(null)).toBe('hash');
    expect(parseAddressMode('bogus')).toBe('hash');
    expect(parseAddressMode('full')).toBe('full');
    expect(parseAddressMode('none')).toBe('none');
  });
});

describe('event shaping', () => {
  test('toChainId accepts hex, decimal and numbers', () => {
    expect(toChainId('0x2105')).toBe(8453);
    expect(toChainId('0x1')).toBe(1);
    expect(toChainId('56')).toBe(56);
    expect(toChainId(4663)).toBe(4663);
    expect(toChainId('0x')).toBeUndefined();
    expect(toChainId('')).toBeUndefined();
    expect(toChainId(null)).toBeUndefined();
    expect(toChainId(-1)).toBeUndefined();
  });

  test('shapeEventData drops empty values', () => {
    expect(shapeEventData({ a: 'x', b: undefined, c: '', d: 0, e: NaN, f: 8453, g: null })).toEqual(
      { a: 'x', d: 0, f: 8453 },
    );
  });

  test('detectWallet reads injected flags', () => {
    const base = { request: async () => null } as Eip1193Provider;
    expect(detectWallet({ ...base, isMetaMask: true })).toBe('io.metamask');
    expect(detectWallet({ ...base, isMetaMask: true, isRabby: true })).toBe('io.rabby');
    expect(detectWallet(base)).toBeUndefined();
  });
});

type Listener = (...args: any[]) => void;

function mockProvider(answers: Record<string, unknown>) {
  const listeners: Record<string, Listener[]> = {};
  const calls: string[] = [];
  const provider: Eip1193Provider = {
    isMetaMask: true,
    request: async ({ method }) => {
      calls.push(method);
      if (method === 'boom') throw new Error('rejected');
      return answers[method];
    },
    on: (event, fn) => {
      listeners[event] = [...(listeners[event] || []), fn];
    },
  };
  const fire = (event: string, value: unknown) => {
    for (const fn of listeners[event] || []) fn(value);
  };
  return { provider, calls, fire };
}

const flush = () => new Promise(resolve => setTimeout(resolve, 5));

describe('initWeb3', () => {
  afterEach(() => {
    delete (window as any).ethereum;
  });

  test('tracks connect, chain switch, tx and disconnect from window.ethereum', async () => {
    const { provider, calls, fire } = mockProvider({
      eth_requestAccounts: [ADDRESS],
      eth_chainId: '0x1',
      wallet_switchEthereumChain: null,
      eth_sendTransaction: TX,
    });
    (window as any).ethereum = provider;
    const track = vi.fn();

    initWeb3(window as any, track, 'hash', 0);
    expect(calls).toEqual([]); // never calls the wallet itself

    const eth = (window as any).ethereum as Eip1193Provider;
    expect(await eth.request({ method: 'eth_chainId' })).toBe('0x1');
    expect(await eth.request({ method: 'eth_requestAccounts' })).toEqual([ADDRESS]);
    await flush();
    await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x2105' }] });
    fire('chainChanged', '0x2105'); // duplicate of the switch, must not double count
    await eth.request({
      method: 'eth_sendTransaction',
      params: [{ from: ADDRESS, to: OTHER, value: '0x0' }],
    });
    fire('accountsChanged', []);
    await vi.waitFor(() => expect(track).toHaveBeenCalledTimes(4));

    expect(calls).toEqual([
      'eth_chainId',
      'eth_requestAccounts',
      'wallet_switchEthereumChain',
      'eth_sendTransaction',
    ]);
    const hash = expectedHash(ADDRESS);
    expect(track.mock.calls).toEqual([
      ['wallet-connect', { address: hash, chainId: 1, wallet: 'io.metamask' }],
      ['chain-switch', { chainId: 8453 }],
      ['tx-sent', { hash: TX, chainId: 8453, to: OTHER, address: hash }],
      ['wallet-disconnect', { wallet: 'io.metamask' }],
    ]);
  });

  test('uses EIP-6963 info, respects address mode none and passes errors through', async () => {
    const { provider } = mockProvider({ eth_requestAccounts: [ADDRESS], eth_chainId: '0x38' });
    window.addEventListener('eip6963:requestProvider', () => {
      window.dispatchEvent(
        new CustomEvent('eip6963:announceProvider', {
          detail: { info: { rdns: 'io.rabby', name: 'Rabby' }, provider },
        }),
      );
    });
    const track = vi.fn();
    initWeb3(window as any, track, 'none', 0);

    await provider.request({ method: 'eth_chainId' });
    await provider.request({ method: 'eth_requestAccounts' });
    await provider.request({ method: 'eth_requestAccounts' }); // same account: no new connect
    await expect(provider.request({ method: 'boom' })).rejects.toThrow('rejected');
    await vi.waitFor(() => expect(track).toHaveBeenCalledTimes(1));
    await flush();

    expect(track.mock.calls).toEqual([['wallet-connect', { chainId: 56, wallet: 'io.rabby' }]]);
  });
});
