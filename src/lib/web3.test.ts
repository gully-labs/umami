import { describe, expect, test } from 'vitest';
import { getChainName, getWalletName, ratio, WEB3_EVENT_NAMES } from './web3';

describe('web3 labels', () => {
  test('names the common chains', () => {
    expect(getChainName('1')).toBe('Ethereum');
    expect(getChainName(8453)).toBe('Base');
    expect(getChainName('56')).toBe('BNB Chain');
    expect(getChainName('4663')).toBe('Robinhood Chain');
    expect(getChainName('5042')).toBe('Arc');
    expect(getChainName('42161')).toBe('Arbitrum');
    expect(getChainName('10')).toBe('Optimism');
    expect(getChainName('137')).toBe('Polygon');
    expect(getChainName('999')).toBe('HyperEVM');
    expect(getChainName('31337')).toBe('Chain 31337');
    expect(getChainName(null)).toBe('Unknown chain');
  });

  test('names wallets from rdns', () => {
    expect(getWalletName('io.metamask')).toBe('MetaMask');
    expect(getWalletName('io.rabby')).toBe('Rabby');
    expect(getWalletName('com.coinbase.wallet')).toBe('Coinbase Wallet');
    expect(getWalletName('xyz.unknown')).toBe('xyz.unknown');
    expect(getWalletName(null)).toBe('Unknown wallet');
  });

  test('ratio never divides by zero', () => {
    expect(ratio(1, 4)).toBe(0.25);
    expect(ratio(3, 0)).toBeNull();
  });

  test('event names match the tracker', () => {
    expect(WEB3_EVENT_NAMES).toEqual([
      'wallet-connect',
      'wallet-disconnect',
      'chain-switch',
      'tx-sent',
    ]);
  });
});
