/**
 * Bungee Auto Integration
 * Cross-chain swaps and bridges via Bungee (mainnet)
 */

import { createWalletClient, createPublicClient, http } from 'viem';
import { privateKeyToAccount, mnemonicToAccount } from 'viem/accounts';
import { base, arbitrum, optimism, mainnet, polygon } from 'viem/chains';
import { createWallet, importWallet, loadWallet, getWalletAddress, walletExists } from './wallet.js';

const BUNGEE_API = 'https://public-backend.bungee.exchange';

// Treasury for fee collection (20 bps = 0.2%)
const FEE_TAKER_ADDRESS = '0x02Bc8c352b58d929Cc3D60545511872c85F30650';
const FEE_BPS = '20'; // 0.2%

const CHAINS: Record<number, typeof base> = {
  1: mainnet,
  8453: base,
  42161: arbitrum,
  10: optimism,
  137: polygon,
};

// ============ Token List ============

export interface TokenBalance {
  chainId: number;
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  balance: string;
  balanceInUsd: number;
}

export async function getTokenBalances(userAddress: string): Promise<TokenBalance[]> {
  const url = `${BUNGEE_API}/api/v1/tokens/list?userAddress=${userAddress}`;
  const response = await fetch(url);
  const data = await response.json() as { success: boolean; result: Record<string, TokenBalance[]> };
  
  if (!data.success) {
    throw new Error('Failed to fetch token list');
  }

  const allTokens: TokenBalance[] = [];
  for (const [chainId, tokens] of Object.entries(data.result)) {
    for (const token of tokens) {
      if (token.balanceInUsd > 0) {
        allTokens.push(token);
      }
    }
  }

  return allTokens.sort((a, b) => b.balanceInUsd - a.balanceInUsd);
}

export function formatPortfolio(tokens: TokenBalance[]): string {
  if (tokens.length === 0) return 'No tokens found.';

  const totalUsd = tokens.reduce((sum, t) => sum + t.balanceInUsd, 0);
  const lines = tokens.map(t => {
    const amount = (Number(t.balance) / Math.pow(10, t.decimals)).toFixed(t.decimals > 6 ? 6 : 2);
    return `  ${t.symbol} (${getChainName(t.chainId)}): ${amount} ($${t.balanceInUsd.toFixed(2)})`;
  });

  return `Portfolio: $${totalUsd.toFixed(2)}\n${lines.join('\n')}`;
}

function getChainName(chainId: number): string {
  const names: Record<number, string> = {
    1: 'Ethereum',
    8453: 'Base',
    42161: 'Arbitrum',
    10: 'Optimism',
    137: 'Polygon',
  };
  return names[chainId] || `Chain ${chainId}`;
}

// ============ Bungee Auto ============

interface QuoteResult {
  quoteId: string;
  requestType: string;
  witness: any;
  signTypedData: any;
  approvalData: any;
  txData: { to: string; data: string; value: string; chainId: number } | null;
  userOp: string | null; // 'tx' for native tokens, null for permit2
  requestHash: string | null; // For native token flow
  inputAmount: string;
  outputAmount: string;
  outputToken: string;
  originChain: number;
  destChain: number;
}

export async function getQuote(params: {
  userAddress: string;
  receiverAddress?: string;
  originChainId: number;
  destinationChainId: number;
  inputToken: string;
  outputToken: string;
  inputAmount: string;
}): Promise<QuoteResult> {
  const quoteParams = new URLSearchParams({
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

  const url = `${BUNGEE_API}/api/v1/bungee/quote?${quoteParams}`;
  const response = await fetch(url);
  const data = await response.json() as any;
  const serverReqId = response.headers.get('server-req-id');

  if (!data.success) {
    throw new Error(`Quote error: ${data.message}. server-req-id: ${serverReqId}`);
  }

  if (!data.result.autoRoute) {
    throw new Error(`No autoRoute available. server-req-id: ${serverReqId}`);
  }

  const auto = data.result.autoRoute;
  
  return {
    quoteId: auto.quoteId,
    requestType: auto.requestType,
    witness: auto.signTypedData?.values?.witness || null,
    signTypedData: auto.signTypedData,
    approvalData: auto.approvalData,
    txData: auto.txData || null,
    userOp: auto.userOp || null,
    requestHash: auto.requestHash || null,
    inputAmount: params.inputAmount,
    outputAmount: auto.output?.amount || auto.outputAmount,
    outputToken: params.outputToken,
    originChain: params.originChainId,
    destChain: params.destinationChainId,
  };
}

export async function executeSwap(
  privateKeyOrMnemonic: string,
  quote: QuoteResult,
  onStatus?: (status: string) => void
): Promise<{ requestHash: string; status: any }> {
  const log = onStatus || console.log;
  
  // Handle mnemonic vs private key
  let account;
  if (privateKeyOrMnemonic.includes(' ')) {
    account = mnemonicToAccount(privateKeyOrMnemonic);
  } else {
    const normalizedKey = privateKeyOrMnemonic.startsWith('0x') ? privateKeyOrMnemonic : `0x${privateKeyOrMnemonic}`;
    account = privateKeyToAccount(normalizedKey as `0x${string}`);
  }
  
  const chain = CHAINS[quote.originChain];
  if (!chain) throw new Error(`Unsupported chain: ${quote.originChain}`);

  const publicClient = createPublicClient({ chain, transport: http() });
  const walletClient = createWalletClient({ account, chain, transport: http() });

  // Native token flow (userOp = 'tx')
  if (quote.userOp === 'tx' && quote.txData) {
    return executeNativeTokenSwap(publicClient, walletClient, quote, log);
  }

  // ERC20 token flow (permit2 signature)
  return executePermit2Swap(publicClient, walletClient, account, quote, log);
}

async function executeNativeTokenSwap(
  publicClient: any,
  walletClient: any,
  quote: QuoteResult,
  log: (msg: string) => void
): Promise<{ requestHash: string; status: any }> {
  if (!quote.txData) throw new Error('Missing txData for native token swap');
  if (!quote.requestHash) throw new Error('Missing requestHash for native token swap');

  log('🔄 Native token swap (direct tx)');
  
  // Step 1: Send the transaction
  log('📤 Step 1/2: Sending transaction...');
  const hash = await walletClient.sendTransaction({
    to: quote.txData.to as `0x${string}`,
    data: quote.txData.data as `0x${string}`,
    value: BigInt(quote.txData.value),
  });
  log(`   TX hash: ${hash}`);

  // Wait for confirmation
  log('   Waiting for confirmation...');
  await publicClient.waitForTransactionReceipt({ hash });
  log('   ✅ Transaction confirmed');

  // Step 2: Poll for completion using requestHash from quote
  log('⏳ Step 2/2: Waiting for Bungee completion...');
  const finalStatus = await pollStatus(quote.requestHash, log);

  return { requestHash: quote.requestHash, status: finalStatus };
}

async function executePermit2Swap(
  publicClient: any,
  walletClient: any,
  account: any,
  quote: QuoteResult,
  log: (msg: string) => void
): Promise<{ requestHash: string; status: any }> {
  log('🔄 ERC20 token swap (permit2)');

  // Step 1: Handle approval if needed
  if (quote.approvalData?.tokenAddress) {
    log('✅ Step 1/4: Checking token approval...');
    await handleApproval(publicClient, walletClient, account.address, quote.approvalData, log);
  } else {
    log('✅ Step 1/4: No approval needed');
  }

  // Step 2: Sign the typed data
  if (!quote.signTypedData || !quote.witness) {
    throw new Error('Missing signTypedData or witness - cannot proceed');
  }

  log('✍️ Step 2/4: Signing permit...');
  const signature = await account.signTypedData({
    types: quote.signTypedData.types,
    primaryType: 'PermitWitnessTransferFrom',
    message: quote.signTypedData.values,
    domain: quote.signTypedData.domain,
  });

  // Step 3: Submit to Bungee
  log('📤 Step 3/4: Submitting to Bungee...');
  const submitPayload = {
    requestType: quote.requestType,
    request: quote.witness,
    userSignature: signature,
    quoteId: quote.quoteId,
  };

  const submitResponse = await fetch(`${BUNGEE_API}/api/v1/bungee/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(submitPayload),
  });
  
  const submitData = await submitResponse.json() as any;
  if (!submitData.success) {
    throw new Error(`Submit error: ${submitData.error?.message || JSON.stringify(submitData)}`);
  }

  const requestHash = submitData.result.requestHash;
  log(`   Request hash: ${requestHash}`);

  // Step 4: Poll for completion
  log('⏳ Step 4/4: Waiting for completion...');
  const finalStatus = await pollStatus(requestHash, log);

  return { requestHash, status: finalStatus };
}

async function handleApproval(
  publicClient: any,
  walletClient: any,
  userAddress: string,
  approvalData: any,
  log: (msg: string) => void
) {
  const erc20Abi = [
    {
      inputs: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
      ],
      name: 'allowance',
      outputs: [{ name: '', type: 'uint256' }],
      stateMutability: 'view',
      type: 'function',
    },
    {
      inputs: [
        { name: 'spender', type: 'address' },
        { name: 'amount', type: 'uint256' },
      ],
      name: 'approve',
      outputs: [{ name: '', type: 'bool' }],
      stateMutability: 'nonpayable',
      type: 'function',
    },
  ] as const;

  const spender = approvalData.spenderAddress === '0' 
    ? '0x000000000022D473030F116dDEE9F6B43aC78BA3' // Permit2
    : approvalData.spenderAddress;

  const currentAllowance = await publicClient.readContract({
    address: approvalData.tokenAddress,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [userAddress, spender],
  });

  if (BigInt(currentAllowance) >= BigInt(approvalData.amount)) {
    log('   Already approved.');
    return;
  }

  log('   Sending approval...');
  const hash = await walletClient.writeContract({
    address: approvalData.tokenAddress,
    abi: erc20Abi,
    functionName: 'approve',
    args: [spender, approvalData.amount],
  });

  log(`   Approval TX: ${hash}`);
  await publicClient.waitForTransactionReceipt({ hash });
  log('   Approval confirmed.');
}

async function pollStatus(
  requestHash: string,
  log: (msg: string) => void,
  maxAttempts = 60
): Promise<any> {
  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(`${BUNGEE_API}/api/v1/bungee/status?requestHash=${requestHash}`);
    const data = await response.json() as any;
    
    if (!data.success) {
      throw new Error(`Status error: ${data.error?.message}`);
    }

    const status = data.result[0];
    const code = status?.bungeeStatusCode;

    if (code === 3 || code === 4) {
      log(`   ✅ Complete! Dest TX: ${status.destinationData?.txHash}`);
      return status;
    }
    if (code === 5) throw new Error('Request expired');
    if (code === 6) throw new Error('Request cancelled');
    if (code === 7) throw new Error('Request refunded');

    if (i % 6 === 0 && i > 0) {
      log(`   Still waiting... (${i * 5}s)`);
    }
    await new Promise(r => setTimeout(r, 5000));
  }
  
  throw new Error('Polling timed out');
}

// ============ CLI ============

async function main() {
  const args = process.argv.slice(2);
  const [action] = args;

  // Wallet commands
  if (action === 'wallet-create') {
    if (walletExists()) {
      console.error('❌ Wallet already exists. Delete .wallet.enc to create a new one.');
      process.exit(1);
    }
    
    const { mnemonic, address } = createWallet();
    console.log(`
🔐 ClawKalash Treasury Created

⚠️  CRITICAL: Save this seed phrase NOW.
    It will NEVER be shown again.

┌────────────────────────────────────────────────────────────┐
  ${mnemonic}
└────────────────────────────────────────────────────────────┘

📍 Address: ${address}

After you've saved the seed phrase securely, you can use:
  npx tsx bungee.ts portfolio
  npx tsx bungee.ts swap ...
`);
    return;
  }

  if (action === 'wallet-import') {
    const keyOrMnemonic = args.slice(1).join(' ');
    if (!keyOrMnemonic) {
      console.error('Usage: npx tsx bungee.ts wallet-import <private-key-or-mnemonic>');
      process.exit(1);
    }
    
    const address = importWallet(keyOrMnemonic);
    console.log(`✅ Wallet imported: ${address}`);
    console.log('⚠️  Delete the message/command containing your key!');
    return;
  }

  if (action === 'wallet-address') {
    const address = getWalletAddress();
    if (!address) {
      console.error('No wallet found. Run: npx tsx bungee.ts wallet-create');
      process.exit(1);
    }
    console.log(address);
    return;
  }

  if (action === 'portfolio') {
    const address = args[1] || getWalletAddress() || process.env.USER_ADDRESS;
    if (!address) {
      console.error('Usage: npx tsx bungee.ts portfolio [address]');
      console.error('Or create a wallet first: npx tsx bungee.ts wallet-create');
      process.exit(1);
    }
    const tokens = await getTokenBalances(address);
    console.log(formatPortfolio(tokens));
    return;
  }

  if (action === 'status') {
    const requestHash = args[1];
    if (!requestHash) {
      console.error('Usage: npx tsx bungee.ts status <requestHash>');
      process.exit(1);
    }
    
    const response = await fetch(`${BUNGEE_API}/api/v1/bungee/status?requestHash=${requestHash}`);
    const data = await response.json() as any;
    
    if (!data.success) {
      console.error('Error:', data.error?.message || 'Unknown error');
      process.exit(1);
    }
    
    const status = data.result[0];
    const codes: Record<number, string> = {
      1: '⏳ PENDING',
      2: '🔄 IN PROGRESS', 
      3: '✅ COMPLETED',
      4: '✅ COMPLETED (partial)',
      5: '❌ EXPIRED',
      6: '❌ CANCELLED',
      7: '↩️ REFUNDED',
    };
    
    console.log(`Status: ${codes[status?.bungeeStatusCode] || 'UNKNOWN'}`);
    if (status?.originData?.txHash) {
      console.log(`Origin TX: ${status.originData.txHash}`);
    }
    if (status?.destinationData?.txHash) {
      console.log(`Dest TX: ${status.destinationData.txHash}`);
    }
    console.log(`\nSocketScan: https://socketscan.io/tx/${requestHash}`);
    return;
  }

  if (action === 'quote') {
    // quote <originChain> <destChain> <inputToken> <outputToken> <amount> <userAddress>
    const [, originChain, destChain, inputToken, outputToken, amount, userAddress] = args;
    if (!userAddress) {
      console.error('Usage: npx tsx bungee.ts quote <originChain> <destChain> <inputToken> <outputToken> <amount> <userAddress>');
      process.exit(1);
    }
    const quote = await getQuote({
      userAddress,
      originChainId: parseInt(originChain),
      destinationChainId: parseInt(destChain),
      inputToken,
      outputToken,
      inputAmount: amount,
    });
    console.log('Quote:', JSON.stringify(quote, null, 2));
    return;
  }

  if (action === 'swap') {
    // Try stored wallet first, then env var
    const wallet = loadWallet();
    const privateKey = wallet?.privateKey || process.env.PRIVATE_KEY;
    
    if (!privateKey) {
      console.error('No wallet found. Either:');
      console.error('  1. Create wallet: npx tsx bungee.ts wallet-create');
      console.error('  2. Set PRIVATE_KEY env var');
      process.exit(1);
    }
    
    // swap <originChain> <destChain> <inputToken> <outputToken> <amount>
    const [, originChain, destChain, inputToken, outputToken, amount] = args;
    
    // Handle mnemonic vs private key
    let account;
    if (privateKey.includes(' ')) {
      account = mnemonicToAccount(privateKey);
    } else {
      const normalized = privateKey.startsWith('0x') ? privateKey as `0x${string}` : `0x${privateKey}`;
      account = privateKeyToAccount(normalized);
    }
    
    console.log('Getting quote...');
    const quote = await getQuote({
      userAddress: account.address,
      originChainId: parseInt(originChain),
      destinationChainId: parseInt(destChain),
      inputToken,
      outputToken,
      inputAmount: amount,
    });
    
    console.log('Executing swap...');
    const result = await executeSwap(privateKey, quote);
    console.log('Done!', result);
    return;
  }

  console.log(`
ClawKalash — Economic Sovereignty for AI Agents

Wallet:
  wallet-create              Create new wallet (shows seed phrase ONCE)
  wallet-import <key|phrase> Import existing wallet
  wallet-address             Show wallet address

Trading:
  portfolio [address]        View cross-chain portfolio
  quote <params...>          Get a swap quote  
  swap <origin> <dest> <in> <out> <amount>   Execute a swap
  status <requestHash>       Check transaction status

Examples:
  npx tsx bungee.ts wallet-create
  npx tsx bungee.ts portfolio
  npx tsx bungee.ts swap 8453 8453 0xEeee...EEEE 0x833589...02913 1000000000000000
  npx tsx bungee.ts status 0xa6b977a6d65f2be870bd7b2b1464d15759a69aa4b321bffafa1f8cbf19343c58

Environment:
  WALLET_KEY   - Encryption key for stored wallet (optional)
  PRIVATE_KEY  - Direct private key (alternative to wallet-create)
`);
}

main().catch(console.error);
