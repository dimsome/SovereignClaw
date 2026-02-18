/**
 * Swap execution (native token + permit2 flows)
 */

import { createWalletClient, createPublicClient, http, formatEther } from 'viem';
import { privateKeyToAccount, mnemonicToAccount } from 'viem/accounts';
import { getChain, getNativeCurrency } from './chains.js';
import { getStatus, submitPermit2 } from './api.js';
import { PERMIT2_ADDRESS, isNativeToken, type QuoteResult } from './types.js';

type LogFn = (msg: string) => void;

// ============ Validation (pure, exported for testing) ============

export function validateNativeTxData(txData: any, expectedAmount: string, expectedChainId: number): void {
  const txValue = BigInt(txData.value);
  const expected = BigInt(expectedAmount);
  if (txValue !== expected) {
    throw new Error(`txData.value (${txValue}) does not match expected input amount (${expected})`);
  }
  if (txData.to === '0x0000000000000000000000000000000000000000') {
    throw new Error('txData.to is the zero address — refusing to send');
  }
  if (txData.chainId && txData.chainId !== expectedChainId) {
    throw new Error(`txData.chainId (${txData.chainId}) does not match origin chain (${expectedChainId})`);
  }
}

export function validatePermit2SignData(signTypedData: any, expectedToken: string, expectedAmount: string): void {
  const domain = signTypedData.domain as Record<string, unknown>;
  const message = signTypedData.values as Record<string, unknown>;
  const permitted = message.permitted as Record<string, unknown> | undefined;

  if (String(domain.verifyingContract).toLowerCase() !== PERMIT2_ADDRESS.toLowerCase()) {
    throw new Error(`Permit2 verifyingContract mismatch: expected ${PERMIT2_ADDRESS}, got ${domain.verifyingContract}`);
  }
  if (permitted) {
    if (String(permitted.amount) !== String(expectedAmount)) {
      throw new Error(`Permit2 amount mismatch: expected ${expectedAmount}, got ${permitted.amount}`);
    }
    if (String(permitted.token).toLowerCase() !== expectedToken.toLowerCase()) {
      throw new Error(`Permit2 token mismatch: expected ${expectedToken}, got ${permitted.token}`);
    }
  }
}

// ============ Account ============

export function getAccount(privateKeyOrMnemonic: string) {
  if (privateKeyOrMnemonic.includes(' ')) {
    return mnemonicToAccount(privateKeyOrMnemonic);
  }
  const key = privateKeyOrMnemonic.startsWith('0x')
    ? privateKeyOrMnemonic
    : `0x${privateKeyOrMnemonic}`;
  return privateKeyToAccount(key as `0x${string}`);
}

export async function executeSwap(
  privateKeyOrMnemonic: string,
  quote: QuoteResult,
  onStatus?: LogFn
): Promise<{ requestHash: string; status: unknown }> {
  const log = onStatus || console.log;
  const account = getAccount(privateKeyOrMnemonic);
  const chain = await getChain(quote.originChain);

  const publicClient = createPublicClient({ chain, transport: http() });
  const walletClient = createWalletClient({ account, chain, transport: http() });

  if (quote.userOp === 'tx' && quote.txData) {
    return executeNativeTokenSwap(publicClient, walletClient, quote, log);
  }

  if (isNativeToken(quote.inputToken)) {
    throw new Error('Native token swap expected txData but none provided in quote');
  }

  return executePermit2Swap(publicClient, walletClient, account, quote, log);
}

async function executeNativeTokenSwap(
  publicClient: ReturnType<typeof createPublicClient>,
  walletClient: ReturnType<typeof createWalletClient>,
  quote: QuoteResult,
  log: LogFn
): Promise<{ requestHash: string; status: unknown }> {
  if (!quote.txData) throw new Error('Missing txData for native token swap');
  if (!quote.requestHash) throw new Error('Missing requestHash for native token swap');

  // Validate txData before sending
  validateNativeTxData(quote.txData, quote.inputAmount, quote.originChain);

  log('🔄 Native token swap (direct tx)');

  // Gas estimation — catch failures before sending
  const txRequest = {
    to: quote.txData.to as `0x${string}`,
    data: quote.txData.data as `0x${string}`,
    value: BigInt(quote.txData.value),
    account: walletClient.account!,
  };

  let gasEstimate: bigint;
  try {
    gasEstimate = await publicClient.estimateGas(txRequest);
    log(`   Estimated gas: ${gasEstimate}`);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`Transaction would fail. Reason: ${reason}`);
  }

  // Check wallet has enough balance for value + gas
  const gasPrice = await publicClient.getGasPrice();
  const gasCost = gasEstimate * gasPrice;
  const totalNeeded = BigInt(quote.txData.value) + gasCost;
  const balance = await publicClient.getBalance({ address: walletClient.account!.address });
  if (balance < totalNeeded) {
    const nativeSymbol = getNativeCurrency(quote.originChain).symbol;
    throw new Error(
      `Insufficient balance. Need ${formatEther(totalNeeded)} ${nativeSymbol} (${formatEther(BigInt(quote.txData.value))} value + ${formatEther(gasCost)} gas), have ${formatEther(balance)} ${nativeSymbol}`
    );
  }

  log('📤 Step 1/2: Sending transaction...');

  const hash = await walletClient.sendTransaction({
    account: walletClient.account!,
    chain: walletClient.chain,
    to: quote.txData.to as `0x${string}`,
    data: quote.txData.data as `0x${string}`,
    value: BigInt(quote.txData.value),
  });
  log(`   TX hash: ${hash}`);

  log('   Waiting for confirmation...');
  await publicClient.waitForTransactionReceipt({ hash });
  log('   ✅ Transaction confirmed');

  log('⏳ Step 2/2: Waiting for Bungee completion...');
  const finalStatus = await pollStatus(quote.requestHash, log);

  return { requestHash: quote.requestHash, status: finalStatus };
}

async function executePermit2Swap(
  publicClient: ReturnType<typeof createPublicClient>,
  walletClient: ReturnType<typeof createWalletClient>,
  account: ReturnType<typeof getAccount>,
  quote: QuoteResult,
  log: LogFn
): Promise<{ requestHash: string; status: unknown }> {
  log('🔄 ERC20 token swap (permit2)');

  // Step 1: Approval
  if (quote.approvalData?.tokenAddress) {
    log('✅ Step 1/4: Checking token approval...');
    await handleApproval(publicClient, walletClient, account.address, quote.approvalData, log);
  } else {
    log('✅ Step 1/4: No approval needed');
  }

  // Check wallet has enough ETH for gas
  const balance = await publicClient.getBalance({ address: account.address });
  if (balance === 0n) {
    throw new Error('Wallet has no ETH for gas fees');
  }

  // Step 2: Sign
  if (!quote.signTypedData || !quote.witness) {
    throw new Error('Missing signTypedData or witness');
  }

  // Validate Permit2 signing data before signing
  validatePermit2SignData(quote.signTypedData, quote.inputToken, quote.inputAmount);

  log('✍️ Step 2/4: Signing permit...');
  const signature = await account.signTypedData({
    types: quote.signTypedData.types as Record<string, Array<{ name: string; type: string }>>,
    primaryType: 'PermitWitnessTransferFrom',
    message: quote.signTypedData.values as Record<string, unknown>,
    domain: quote.signTypedData.domain as Record<string, unknown>,
  });

  // Step 3: Submit
  log('📤 Step 3/4: Submitting to Bungee...');
  const requestHash = await submitPermit2({
    requestType: quote.requestType,
    request: quote.witness,
    userSignature: signature,
    quoteId: quote.quoteId,
  });
  log(`   Request hash: ${requestHash}`);

  // Step 4: Poll
  log('⏳ Step 4/4: Waiting for completion...');
  const finalStatus = await pollStatus(requestHash, log);

  return { requestHash, status: finalStatus };
}

const ERC20_ABI = [
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

async function handleApproval(
  publicClient: ReturnType<typeof createPublicClient>,
  walletClient: ReturnType<typeof createWalletClient>,
  userAddress: string,
  approvalData: { tokenAddress: string; spenderAddress: string; amount: string },
  log: LogFn
) {
  const spender = approvalData.spenderAddress === '0'
    ? PERMIT2_ADDRESS
    : approvalData.spenderAddress;

  const currentAllowance = await publicClient.readContract({
    address: approvalData.tokenAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [userAddress as `0x${string}`, spender as `0x${string}`],
  });

  if (BigInt(currentAllowance) >= BigInt(approvalData.amount)) {
    log('   Already approved.');
    return;
  }

  log('   Simulating approval...');
  let approveRequest;
  try {
    const { request } = await publicClient.simulateContract({
      address: approvalData.tokenAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [spender as `0x${string}`, BigInt(approvalData.amount)],
      account: walletClient.account!,
    });
    approveRequest = request;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`Approval would fail. Reason: ${reason}`);
  }

  log('   Sending approval...');
  const hash = await walletClient.writeContract(approveRequest);

  log(`   Approval TX: ${hash}`);
  await publicClient.waitForTransactionReceipt({ hash });
  log('   Approval confirmed.');
}

async function pollStatus(
  requestHash: string,
  log: LogFn,
  maxAttempts = 20
): Promise<unknown> {
  const socketScanUrl = `https://socketscan.io/tx/${requestHash}`;
  // Start at 15s, increase to 30s after a few attempts (respect 5 calls/min limit)
  for (let i = 0; i < maxAttempts; i++) {
    const delay = i < 4 ? 15_000 : 30_000;
    await new Promise(r => setTimeout(r, delay));

    const results = await getStatus(requestHash);
    const status = results[0];
    const code = status?.bungeeStatusCode;

    if (code === 3 || code === 4) {
      log(`   ✅ Complete! Dest TX: ${status.destinationData?.txHash}`);
      return status;
    }
    if (code === 5) throw new Error('Request expired');
    if (code === 6) throw new Error('Request cancelled');
    if (code === 7) throw new Error('Request refunded');

    const elapsed = i < 4 ? (i + 1) * 15 : 60 + (i - 3) * 30;
    log(`   Still waiting... (${elapsed}s) — ${socketScanUrl}`);
  }

  throw new Error(`Polling timed out. Track manually: ${socketScanUrl}`);
}
