import { describe, it, expect } from 'vitest';
import { searchTokens, resolveToken, getQuote, getTokenBalances, getStatus } from '../scripts/api.js';

const TEST_ADDRESS = '0x02Bc8c352b58d929Cc3D60545511872c85F30650';
const USDC_BASE = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
const USDC_ARB = '0xaf88d065e77c8cc2239327c5edb3a432268e5831';

describe('API Integration Tests', () => {
  describe('searchTokens', () => {
    it('returns results for USDC', async () => {
      const results = await searchTokens('USDC');
      expect(results.length).toBeGreaterThan(0);
    });

    it('returns tokens with required fields', async () => {
      const results = await searchTokens('USDC');
      const token = results[0];
      expect(token).toHaveProperty('chainId');
      expect(token).toHaveProperty('address');
      expect(token).toHaveProperty('symbol');
      expect(token).toHaveProperty('decimals');
    });

    it('finds USDC on Base', async () => {
      const results = await searchTokens('USDC');
      const baseUsdc = results.find(
        t => t.symbol === 'USDC' && t.chainId === 8453 && t.address.toLowerCase() === USDC_BASE
      );
      expect(baseUsdc).toBeDefined();
      expect(baseUsdc!.decimals).toBe(6);
    });

    it('finds USDC on Arbitrum', async () => {
      const results = await searchTokens('USDC');
      const arbUsdc = results.find(
        t => t.symbol === 'USDC' && t.chainId === 42161 && t.address.toLowerCase() === USDC_ARB
      );
      expect(arbUsdc).toBeDefined();
      expect(arbUsdc!.decimals).toBe(6);
    });

    it('returns results for ETH', async () => {
      const results = await searchTokens('ETH');
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('resolveToken', () => {
    it('resolves USDC symbol to correct Base address', async () => {
      const token = await resolveToken('USDC', 8453);
      expect(token.address.toLowerCase()).toBe(USDC_BASE);
      expect(token.symbol).toBe('USDC');
      expect(token.decimals).toBe(6);
    });

    it('resolves USDC symbol to correct Arbitrum address', async () => {
      const token = await resolveToken('USDC', 42161);
      expect(token.address.toLowerCase()).toBe(USDC_ARB);
      expect(token.symbol).toBe('USDC');
      expect(token.decimals).toBe(6);
    });

    it('resolves USDC address to correct metadata', async () => {
      const token = await resolveToken(USDC_BASE, 8453);
      expect(token.symbol).toBe('USDC');
      expect(token.decimals).toBe(6);
    });

    it('resolves case-insensitive symbol', async () => {
      const token = await resolveToken('usdc', 8453);
      expect(token.address.toLowerCase()).toBe(USDC_BASE);
    });

    it('throws for unknown token on chain', async () => {
      await expect(resolveToken('XYZNONEXISTENT', 8453)).rejects.toThrow();
    });
  });

  describe('getTokenBalances', () => {
    it('returns array for valid address', async () => {
      const balances = await getTokenBalances(TEST_ADDRESS);
      expect(Array.isArray(balances)).toBe(true);
    });

    it('tokens have required fields', async () => {
      const balances = await getTokenBalances(TEST_ADDRESS);
      if (balances.length > 0) {
        const token = balances[0];
        expect(token).toHaveProperty('chainId');
        expect(token).toHaveProperty('symbol');
        expect(token).toHaveProperty('balance');
        expect(token).toHaveProperty('balanceInUsd');
      }
    });
  });

  describe('getQuote', () => {
    it('returns quote for USDC Base → Arbitrum', async () => {
      const quote = await getQuote({
        userAddress: TEST_ADDRESS,
        originChainId: 8453,
        destinationChainId: 42161,
        inputToken: USDC_BASE,
        outputToken: USDC_ARB,
        inputAmount: '2250000', // 2.25 USDC
      });
      expect(quote).toHaveProperty('quoteId');
      expect(quote).toHaveProperty('requestType');
      expect(quote).toHaveProperty('outputAmount');
      expect(Number(quote.outputAmount)).toBeGreaterThan(0);
    });
  });

  describe('getStatus', () => {
    it('throws for invalid request hash', async () => {
      await expect(getStatus('0xinvalid')).rejects.toThrow();
    });
  });
});
