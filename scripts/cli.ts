/**
 * ClawKalash CLI — Entry point
 */

import { getTokenBalances, getQuote, getStatus, searchTokens, resolveToken } from './api.js';
import { parseAmount } from './utils.js';
import { executeSwap } from './swap.js';
import { createWallet, importWallet, loadWallet, getWalletAddress, walletExists } from './wallet.js';
import { getChainName, fetchSupportedChains } from './chains.js';
import { STATUS_CODES, type TokenBalance } from './types.js';

// ============ Formatting ============

export function formatPortfolio(tokens: TokenBalance[]): string {
  if (tokens.length === 0) return 'No tokens found.';

  const totalUsd = tokens.reduce((sum, t) => sum + t.balanceInUsd, 0);
  const lines = tokens.map(t => {
    const amount = (Number(t.balance) / Math.pow(10, t.decimals)).toFixed(Math.min(t.decimals, 6));
    return `  ${t.symbol} (${getChainName(t.chainId)}): ${amount} ($${t.balanceInUsd.toFixed(2)})`;
  });

  return `Portfolio: $${totalUsd.toFixed(2)}\n${lines.join('\n')}`;
}

export function formatQuotePreview(quote: Awaited<ReturnType<typeof getQuote>>): string {
  const lines = [
    `🔍 Swap Preview (dry run)`,
    `  From: ${getChainName(quote.originChain)} → ${getChainName(quote.destChain)}`,
    `  Input:  ${quote.inputAmount} (${quote.inputToken})`,
    `  Output: ${quote.outputAmount} (${quote.outputToken})`,
    `  Quote ID: ${quote.quoteId}`,
    `  Flow: ${quote.userOp === 'tx' ? 'Native token (direct tx)' : 'ERC20 (permit2)'}`,
  ];
  if (quote.approvalData?.tokenAddress) {
    lines.push(`  ⚠️  Token approval required`);
  }
  return lines.join('\n');
}

// ============ Helpers ============

export function parseChainId(input: string, label: string): number {
  const id = parseInt(input, 10);
  if (isNaN(id)) {
    throw new Error(`Invalid ${label}: "${input}" is not a valid chain ID`);
  }
  return id;
}

async function readStdin(): Promise<string> {
  // Check if stdin has data (piped)
  if (process.stdin.isTTY) {
    // Interactive: prompt
    process.stderr.write('Enter private key or mnemonic: ');
  }
  const chunks: Uint8Array[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8').trim();
}

// ============ Argument Parsing ============

export function parseArgs(argv: string[]): { command: string; args: string[]; flags: Record<string, string | boolean> } {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }

  return { command: positional[0] || 'help', args: positional.slice(1), flags };
}

// ============ Command Handlers ============

async function handleWalletCreate() {
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
`);
}

async function handleWalletImport() {
  const keyOrMnemonic = await readStdin();
  if (!keyOrMnemonic) {
    console.error('Usage: echo "my-key" | ck wallet-import');
    console.error('   or: ck wallet-import  (interactive prompt)');
    process.exit(1);
  }
  const address = importWallet(keyOrMnemonic);
  console.log(`✅ Wallet imported: ${address}`);
}

async function handleWalletAddress() {
  const address = getWalletAddress();
  if (!address) {
    console.error('No wallet found. Run: ck wallet-create');
    process.exit(1);
  }
  console.log(address);
}

async function handlePortfolio(args: string[]) {
  const address = args[0] || getWalletAddress() || process.env.USER_ADDRESS;
  if (!address) {
    console.error('Usage: ck portfolio [address]');
    process.exit(1);
  }
  const tokens = await getTokenBalances(address);
  console.log(formatPortfolio(tokens));
}

async function handleSearch(args: string[]) {
  const query = args.join(' ');
  if (!query) {
    console.error('Usage: ck search <query>');
    process.exit(1);
  }
  const results = await searchTokens(query);
  if (results.length === 0) {
    console.log('No tokens found.');
    return;
  }
  console.log(`Found ${results.length} token(s):\n`);
  for (const t of results.slice(0, 20)) {
    console.log(`  ${t.symbol} (${t.name}) — ${getChainName(t.chainId)} — ${t.address}`);
  }
}

async function handleQuote(args: string[]) {
  const [originChain, destChain, inputToken, outputToken, amount, userAddress] = args;
  if (!userAddress) {
    console.error('Usage: ck quote <originChain> <destChain> <inputToken> <outputToken> <amount> <userAddress>');
    process.exit(1);
  }

  const originChainId = parseChainId(originChain, 'originChain');
  const destChainId = parseChainId(destChain, 'destChain');

  // Resolve tokens by symbol if needed
  const resolvedInput = await resolveToken(inputToken, originChainId);
  const resolvedOutput = await resolveToken(outputToken, destChainId);

  const parsedAmount = parseAmount(amount, resolvedInput.decimals);

  const quote = await getQuote({
    userAddress,
    originChainId,
    destinationChainId: destChainId,
    inputToken: resolvedInput.address,
    outputToken: resolvedOutput.address,
    inputAmount: parsedAmount,
  });
  console.log('Quote:', JSON.stringify(quote, null, 2));
}

async function handleSwap(args: string[], flags: Record<string, string | boolean>) {
  const wallet = loadWallet();
  const privateKey = wallet?.privateKey || process.env.PRIVATE_KEY;

  if (!privateKey) {
    console.error('No wallet found. Either:');
    console.error('  1. Create wallet: ck wallet-create');
    console.error('  2. Set PRIVATE_KEY env var');
    process.exit(1);
  }

  const [originChain, destChain, inputToken, outputToken, amount] = args;
  if (!amount) {
    console.error('Usage: ck swap <originChain> <destChain> <inputToken> <outputToken> <amount> [--dry-run]');
    process.exit(1);
  }

  const originChainId = parseChainId(originChain, 'originChain');
  const destChainId = parseChainId(destChain, 'destChain');

  // Resolve tokens
  const resolvedInput = await resolveToken(inputToken, originChainId);
  const resolvedOutput = await resolveToken(outputToken, destChainId);

  // Get account address from wallet
  const { mnemonicToAccount, privateKeyToAccount } = await import('viem/accounts');
  let account;
  if (privateKey.includes(' ')) {
    account = mnemonicToAccount(privateKey);
  } else {
    const normalized = privateKey.startsWith('0x') ? privateKey as `0x${string}` : `0x${privateKey}`;
    account = privateKeyToAccount(normalized as `0x${string}`);
  }

  const parsedAmount = parseAmount(amount, resolvedInput.decimals);
  console.log('Getting quote...');
  const quote = await getQuote({
    userAddress: account.address,
    originChainId,
    destinationChainId: destChainId,
    inputToken: resolvedInput.address,
    outputToken: resolvedOutput.address,
    inputAmount: parsedAmount,
  });

  if (flags['dry-run']) {
    console.log(formatQuotePreview(quote));
    return;
  }

  console.log('Executing swap...');
  const result = await executeSwap(privateKey, quote);
  console.log(`\n✅ Swap complete!`);
  console.log(`   🔗 https://socketscan.io/tx/${result.requestHash}`);
}

async function handleStatus(args: string[]) {
  const requestHash = args[0];
  if (!requestHash) {
    console.error('Usage: ck status <requestHash>');
    process.exit(1);
  }

  const results = await getStatus(requestHash);
  const status = results[0];

  console.log(`Status: ${STATUS_CODES[status?.bungeeStatusCode] || 'UNKNOWN'}`);
  if (status?.originData?.txHash) {
    console.log(`Origin TX: ${status.originData.txHash}`);
  }
  if (status?.destinationData?.txHash) {
    console.log(`Dest TX: ${status.destinationData.txHash}`);
  }
  console.log(`\nSocketScan: https://socketscan.io/tx/${requestHash}`);
}

function showHelp() {
  console.log(`
🥩 ClawKalash — Economic Sovereignty for AI Agents

Wallet:
  wallet-create              Create new wallet (shows seed phrase ONCE)
  wallet-import              Import wallet (reads key/mnemonic from stdin)
  wallet-address             Show wallet address

Trading:
  portfolio [address]        View cross-chain portfolio
  search <query>             Search tokens by name/symbol
  quote <params...>          Get a swap quote
  swap <origin> <dest> <in> <out> <amount> [--dry-run]
  status <requestHash>       Check transaction status

Token inputs accept addresses (0x...) or symbols (ETH, USDC).

Examples:
  ck wallet-create
  echo "0xprivatekey" | ck wallet-import
  ck portfolio
  ck search USDC
  ck swap 8453 8453 ETH USDC 1000000000000000 --dry-run
  ck status 0xa6b977...

Environment:
  WALLET_KEY   - Encryption key for stored wallet (REQUIRED)
  PRIVATE_KEY  - Direct private key (alternative to wallet-create)
`);
}

// ============ Main ============

const COMMANDS: Record<string, (args: string[], flags: Record<string, string | boolean>) => Promise<void> | void> = {
  'wallet-create': () => handleWalletCreate(),
  'wallet-import': () => handleWalletImport(),
  'wallet-address': () => handleWalletAddress(),
  'portfolio': (args) => handlePortfolio(args),
  'search': (args) => handleSearch(args),
  'quote': (args) => handleQuote(args),
  'swap': (args, flags) => handleSwap(args, flags),
  'status': (args) => handleStatus(args),
  'help': () => showHelp(),
};

const NEEDS_CHAINS = new Set(['portfolio', 'search', 'quote', 'swap', 'status']);

async function main() {
  const { command, args, flags } = parseArgs(process.argv.slice(2));
  const handler = COMMANDS[command];

  if (!handler) {
    console.error(`Unknown command: ${command}`);
    showHelp();
    process.exit(1);
  }

  // Pre-fetch chain data for commands that display chain names
  if (NEEDS_CHAINS.has(command)) {
    await fetchSupportedChains().catch(() => {
      // Non-fatal: chain names will fall back to viem or "Chain <id>"
    });
  }

  await handler(args, flags);
}

main().catch(err => {
  console.error('Error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
