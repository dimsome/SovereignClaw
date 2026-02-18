import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildQuoteParams } from '../scripts/api.js';
import { FEE_TAKER_ADDRESS, FEE_BPS } from '../scripts/types.js';

describe('buildQuoteParams', () => {
  it('builds correct URL params', () => {
    const params = buildQuoteParams({
      userAddress: '0xuser',
      originChainId: 8453,
      destinationChainId: 42161,
      inputToken: '0xinput',
      outputToken: '0xoutput',
      inputAmount: '1000000',
    });

    expect(params.get('userAddress')).toBe('0xuser');
    expect(params.get('receiverAddress')).toBe('0xuser');
    expect(params.get('originChainId')).toBe('8453');
    expect(params.get('destinationChainId')).toBe('42161');
    expect(params.get('inputToken')).toBe('0xinput');
    expect(params.get('outputToken')).toBe('0xoutput');
    expect(params.get('inputAmount')).toBe('1000000');
    expect(params.get('feeTakerAddress')).toBe(FEE_TAKER_ADDRESS);
    expect(params.get('feeBps')).toBe(FEE_BPS);
  });

  it('uses custom receiver when provided', () => {
    const params = buildQuoteParams({
      userAddress: '0xuser',
      receiverAddress: '0xreceiver',
      originChainId: 1,
      destinationChainId: 1,
      inputToken: '0xa',
      outputToken: '0xb',
      inputAmount: '100',
    });

    expect(params.get('receiverAddress')).toBe('0xreceiver');
  });
});

// ============ Mocked API Tests ============

describe('searchTokens (mocked)', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const mockNestedResponse = {
    success: true,
    statusCode: 200,
    result: {
      tokens: {
        '8453': [
          { chainId: 8453, address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', name: 'USDC', symbol: 'USDC', decimals: 6, isVerified: true, isShortListed: false },
          { chainId: 8453, address: '0x6833a1754b3945aca715b3a6a0fdd02bc18a8672', name: 'Fake USDC', symbol: 'USDC', decimals: 18, isVerified: false, isShortListed: false },
        ],
        '42161': [
          { chainId: 42161, address: '0xaf88d065e77c8cc2239327c5edb3a432268e5831', name: 'USDC', symbol: 'USDC', decimals: 6, isVerified: true, isShortListed: true },
        ],
        '1': [
          { chainId: 1, address: '0xd63070114470f685b75b74d60eec7c1113d33a3d', name: 'MEV Capital USDC', symbol: 'MWUSDC', decimals: 18, isVerified: true, isShortListed: false },
          { chainId: 1, address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', name: 'USDC', symbol: 'USDC', decimals: 6, isVerified: true, isShortListed: true },
        ],
      },
    },
  };

  function mockFetch(data: any) {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve(data),
    } as any);
  }

  it('flattens nested token response', async () => {
    mockFetch(mockNestedResponse);
    const { searchTokens } = await import('../scripts/api.js');
    const results = await searchTokens('USDC');
    expect(results.length).toBe(5);
  });

  it('sorts verified/shortlisted tokens first', async () => {
    mockFetch(mockNestedResponse);
    const { searchTokens } = await import('../scripts/api.js');
    const results = await searchTokens('USDC');
    // Shortlisted + verified (score 3) should come first
    expect(results[0].isShortListed).toBe(true);
  });

  it('handles flat array response (backwards compat)', async () => {
    mockFetch({
      success: true,
      result: [
        { chainId: 8453, address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', symbol: 'USDC', decimals: 6 },
      ],
    });
    const { searchTokens } = await import('../scripts/api.js');
    const results = await searchTokens('USDC');
    expect(results.length).toBe(1);
    expect(results[0].symbol).toBe('USDC');
  });

  it('throws on failed response', async () => {
    mockFetch({ success: false, message: 'Bad request' });
    const { searchTokens } = await import('../scripts/api.js');
    await expect(searchTokens('USDC')).rejects.toThrow('Failed to search tokens');
  });
});

describe('resolveToken (mocked)', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const mockResponse = {
    success: true,
    result: {
      tokens: {
        '8453': [
          { chainId: 8453, address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', symbol: 'USDC', decimals: 6, isVerified: true, isShortListed: false },
          { chainId: 8453, address: '0x6833a1754b3945aca715b3a6a0fdd02bc18a8672', symbol: 'USDC', decimals: 18, isVerified: false, isShortListed: false },
          { chainId: 8453, address: '0xaaaa', symbol: 'MWUSDC', decimals: 18, isVerified: true, isShortListed: false },
        ],
        '42161': [
          { chainId: 42161, address: '0xaf88d065e77c8cc2239327c5edb3a432268e5831', symbol: 'USDC', decimals: 6, isVerified: true, isShortListed: true },
        ],
      },
    },
  };

  function mockFetch(data: any) {
    globalThis.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve(data),
    } as any);
  }

  it('exact symbol match on correct chain', async () => {
    mockFetch(mockResponse);
    const { resolveToken } = await import('../scripts/api.js');
    const token = await resolveToken('USDC', 8453);
    expect(token.address).toBe('0x833589fcd6edb6e08f4c7c32d4f71b54bda02913');
    expect(token.decimals).toBe(6);
  });

  it('prefers exact symbol over partial match', async () => {
    mockFetch(mockResponse);
    const { resolveToken } = await import('../scripts/api.js');
    const token = await resolveToken('USDC', 42161);
    expect(token.symbol).toBe('USDC');
    expect(token.decimals).toBe(6);
  });

  it('resolves address with correct decimals', async () => {
    mockFetch(mockResponse);
    const { resolveToken } = await import('../scripts/api.js');
    const token = await resolveToken('0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', 8453);
    expect(token.decimals).toBe(6);
    expect(token.symbol).toBe('USDC');
  });

  it('address lookup is case-insensitive', async () => {
    mockFetch(mockResponse);
    const { resolveToken } = await import('../scripts/api.js');
    const token = await resolveToken('0x833589FCD6EDB6E08F4C7C32D4F71B54BDA02913', 8453);
    expect(token.decimals).toBe(6);
  });

  it('falls back to 18 decimals for unknown address', async () => {
    mockFetch({ success: true, result: { tokens: {} } });
    const { resolveToken } = await import('../scripts/api.js');
    const token = await resolveToken('0x0000000000000000000000000000000000000001', 8453);
    expect(token.decimals).toBe(18);
  });

  it('throws for unknown symbol', async () => {
    mockFetch({ success: true, result: { tokens: {} } });
    const { resolveToken } = await import('../scripts/api.js');
    await expect(resolveToken('XYZFAKE', 8453)).rejects.toThrow('not found');
  });
});
