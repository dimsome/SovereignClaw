/**
 * Bungee API client
 */

import {
  BUNGEE_API, FEE_TAKER_ADDRESS, FEE_BPS,
  type TokenBalance, type QuoteParams, type QuoteResult,
  type BungeeStatusResult, type TokenSearchResult,
} from './types.js';

// ============ Retry Wrapper ============

async function withRetry<T>(fn: () => Promise<T>, attempts = 3, delayMs = 1000): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === attempts - 1) throw err;
      const isRateLimit = err instanceof Error && (
        err.message.includes('429') ||
        err.message.includes('<!doctype') ||
        err.message.includes('is not valid JSON')
      );
      const wait = isRateLimit ? Math.max(delayMs * (i + 1), 3000) * (i + 1) : delayMs * (i + 1);
      if (isRateLimit) console.warn(`Rate limited, waiting ${Math.round(wait / 1000)}s before retry...`);
      await new Promise(r => setTimeout(r, wait));
    }
  }
  throw new Error('Unreachable');
}

async function safeFetch(url: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(url, init);
  if (response.status === 429) {
    throw new Error('429 Too Many Requests');
  }
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('json')) {
    throw new Error(`Expected JSON but got ${contentType}. Status: ${response.status}`);
  }
  return response;
}

// ============ Token List / Portfolio ============

export async function getTokenBalances(userAddress: string): Promise<TokenBalance[]> {
  return withRetry(async () => {
    const url = `${BUNGEE_API}/api/v1/tokens/list?userAddress=${userAddress}`;
    const response = await safeFetch(url);
    const data = await response.json() as { success?: boolean; result?: Record<string, TokenBalance[]> };

    if (!data.success || !data.result) {
      throw new Error('Failed to fetch token list');
    }

    const allTokens: TokenBalance[] = [];
    for (const tokens of Object.values(data.result)) {
      for (const token of tokens) {
        if (token.balanceInUsd > 0) {
          allTokens.push(token);
        }
      }
    }

    return allTokens.sort((a, b) => b.balanceInUsd - a.balanceInUsd);
  });
}

// ============ Token Search ============

export async function searchTokens(query: string, userAddress?: string): Promise<TokenSearchResult[]> {
  let url = `${BUNGEE_API}/api/v1/tokens/search?q=${encodeURIComponent(query)}`;
  if (userAddress) url += `&address=${userAddress}`;
  const response = await safeFetch(url);
  const data = await response.json() as { success?: boolean; result?: any };

  if (!data.success || !data.result) {
    throw new Error('Failed to search tokens');
  }

  // API returns { tokens: { [chainId]: TokenSearchResult[] } }
  const tokens = data.result.tokens || data.result;
  if (Array.isArray(tokens)) return tokens;

  const flat: TokenSearchResult[] = [];
  for (const chainTokens of Object.values(tokens)) {
    if (Array.isArray(chainTokens)) flat.push(...chainTokens);
  }
  // Prefer verified/shortlisted tokens for better symbol matching
  flat.sort((a, b) => {
    const aScore = (a.isShortListed ? 2 : 0) + (a.isVerified ? 1 : 0);
    const bScore = (b.isShortListed ? 2 : 0) + (b.isVerified ? 1 : 0);
    return bScore - aScore;
  });
  return flat;
}

// Search cache to avoid redundant API calls (5 calls/min limit)
const searchCache = new Map<string, { results: TokenSearchResult[]; ts: number }>();
const CACHE_TTL = 60_000; // 1 minute

async function cachedSearch(query: string): Promise<TokenSearchResult[]> {
  const key = query.toLowerCase();
  const cached = searchCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.results;
  const results = await searchTokens(query);
  searchCache.set(key, { results, ts: Date.now() });
  return results;
}

/**
 * Resolve a token by address or symbol on a specific chain.
 * Relies on Bungee's search endpoint which handles both.
 */
export async function resolveToken(input: string, chainId: number): Promise<{ address: string; symbol: string; decimals: number }> {
  const isAddress = input.startsWith('0x') && input.length === 42;
  const results = await cachedSearch(input);

  if (isAddress) {
    const match = results.find(t => t.address.toLowerCase() === input.toLowerCase() && t.chainId === chainId);
    if (match) return { address: match.address, symbol: match.symbol, decimals: match.decimals };
    const anyMatch = results.find(t => t.address.toLowerCase() === input.toLowerCase());
    if (anyMatch) return { address: input, symbol: anyMatch.symbol, decimals: anyMatch.decimals };
    console.warn(`Warning: could not fetch metadata for ${input}, assuming 18 decimals`);
    return { address: input, symbol: input.slice(0, 8), decimals: 18 };
  }

  // Exact symbol match on target chain
  const exactOnChain = results.find(
    t => t.symbol.toLowerCase() === input.toLowerCase() && t.chainId === chainId
  );
  if (exactOnChain) return { address: exactOnChain.address, symbol: exactOnChain.symbol, decimals: exactOnChain.decimals };

  // Any match on target chain
  const onChain = results.find(t => t.chainId === chainId);
  if (onChain) return { address: onChain.address, symbol: onChain.symbol, decimals: onChain.decimals };

  throw new Error(`Token "${input}" not found on chain ${chainId}`);
}

// ============ Quote ============

export function buildQuoteParams(params: QuoteParams): URLSearchParams {
  return new URLSearchParams({
    userAddress: params.userAddress,
    receiverAddress: params.receiverAddress || params.userAddress,
    originChainId: String(params.originChainId),
    destinationChainId: String(params.destinationChainId),
    inputToken: params.inputToken,
    outputToken: params.outputToken,
    inputAmount: params.inputAmount,
    feeTakerAddress: FEE_TAKER_ADDRESS,
    feeBps: FEE_BPS,
  });
}

export async function getQuote(params: QuoteParams): Promise<QuoteResult> {
  return withRetry(async () => {
    const quoteParams = buildQuoteParams(params);
    const url = `${BUNGEE_API}/api/v1/bungee/quote?${quoteParams}`;
    const response = await safeFetch(url);
    const data = await response.json() as Record<string, unknown>;
    const serverReqId = response.headers.get('server-req-id');

    if (!data.success) {
      throw new Error(`Quote error: ${data.message}. server-req-id: ${serverReqId}`);
    }

    const result = data.result as Record<string, unknown>;
    if (!result) {
      throw new Error(`No result in quote response. server-req-id: ${serverReqId}`);
    }

    const auto = result.autoRoute as Record<string, unknown> | undefined;

    if (!auto) {
      throw new Error(`No autoRoute available. server-req-id: ${serverReqId}`);
    }

    const signTypedData = auto.signTypedData as QuoteResult['signTypedData'];
    const output = auto.output as Record<string, string> | undefined;

    return {
      quoteId: auto.quoteId as string,
      requestType: auto.requestType as string,
      witness: signTypedData?.values?.witness as Record<string, unknown> | null ?? null,
      signTypedData,
      approvalData: (auto.approvalData as QuoteResult['approvalData']) || null,
      txData: (auto.txData as QuoteResult['txData']) || null,
      userOp: (auto.userOp as string) || null,
      requestHash: (auto.requestHash as string) || null,
      inputAmount: params.inputAmount,
      outputAmount: output?.amount || (auto.outputAmount as string) || '0',
      inputToken: params.inputToken,
      outputToken: params.outputToken,
      originChain: params.originChainId,
      destChain: params.destinationChainId,
    };
  });
}

// ============ Status ============

export async function getStatus(requestHash: string): Promise<BungeeStatusResult[]> {
  const response = await safeFetch(`${BUNGEE_API}/api/v1/bungee/status?requestHash=${requestHash}`);
  const data = await response.json() as { success?: boolean; result?: BungeeStatusResult[]; error?: { message: string } };

  if (!data.success || !data.result) {
    throw new Error(`Status error: ${data.error?.message || 'Unknown error'}`);
  }

  return data.result;
}

// ============ Submit ============

export async function submitPermit2(payload: {
  requestType: string;
  request: Record<string, unknown>;
  userSignature: string;
  quoteId: string;
}): Promise<string> {
  return withRetry(async () => {
    const response = await safeFetch(`${BUNGEE_API}/api/v1/bungee/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json() as { success?: boolean; result?: { requestHash: string }; error?: { message: string } };
    if (!data.success || !data.result?.requestHash) {
      throw new Error(`Submit error: ${data.error?.message || JSON.stringify(data)}`);
    }

    return data.result.requestHash;
  });
}
