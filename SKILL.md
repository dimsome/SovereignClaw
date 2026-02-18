---
name: clawkalash
description: Economic sovereignty for AI agents. Create wallets, check portfolio, swap any token on any chain via Bungee. Supports ERC20 (Permit2) and native tokens across 30+ chains. Treasury management, payments, portfolio tracking.
version: 0.4.4
author: BotBot (OpenClaw agent for @dimsome)
---

# ClawKalash 🥩

Economic sovereignty for AI agents. Any asset. Any chain. Served on a stick.

## Capabilities

| Capability | Description |
|------------|-------------|
| **Wallet Management** | Create wallets, import keys, encrypted storage |
| **Portfolio View** | Check balances across all chains via Bungee API |
| **Cross-Chain Swaps** | Any token → any token across 30+ chains |
| **Native Token Swaps** | ETH/MATIC/etc via direct transactions |
| **ERC20 Swaps** | Gasless via Permit2 signatures |
| **Status Tracking** | Monitor transactions via SocketScan |

## When to Activate

- "Create a wallet for me"
- "Get me 100 USDC on Arbitrum"
- "Bridge ETH from Base to Optimism"
- "Swap 0.1 ETH to USDC"
- "What's my balance?"
- "Show my portfolio"

## Quick Start

### 1. Create Wallet

```bash
export WALLET_KEY="your-secret-encryption-key"
ck wallet-create
```

**⚠️ CRITICAL:** Seed phrase shown ONCE. User must confirm backup before proceeding.

### 2. Import Wallet

```bash
echo "0xprivatekey" | ck wallet-import
```

### 3. Check Portfolio

```bash
ck portfolio
```

### 4. Execute Swap

```bash
ck swap 8453 8453 0xEeee...EEEE 0x833589...02913 1000000000000000
```

### 5. Monitor Status

**CLI:**
```bash
ck status <requestHash>
```

**ALWAYS share the SocketScan link with the user:**
```
https://socketscan.io/tx/<requestHash>
```

## Command Reference

| Command | Description |
|---------|-------------|
| `ck wallet-create` | Create new wallet, show seed once |
| `ck wallet-import` | Import key/mnemonic from stdin |
| `ck wallet-address` | Show wallet address |
| `ck portfolio [addr]` | View all balances |
| `ck search <query>` | Search tokens by name/symbol |
| `ck quote <params>` | Get swap quote |
| `ck swap <params>` | Execute swap |
| `ck status <hash>` | Check tx status |

### Parameters

```
swap <originChainId> <destChainId> <inputToken> <outputToken> <amount>

Example: ck swap 8453 42161 ETH USDC 1000000000000000
         (Base → Arbitrum, 0.001 ETH → USDC)
```

Token inputs accept addresses (0x...) or symbols (ETH, USDC).

## Workflows

### Cross-Chain Swap (ERC20)

1. Get quote → returns `signTypedData`
2. Sign Permit2 typed data (gasless)
3. Submit signature to Bungee
4. Poll status and show link to SocketScan

### Cross-Chain Swap (Native Token)

1. Get quote → returns `txData`
2. Send transaction directly onchain
3. Poll status and show link to SocketScan

> **⚠️ IMPORTANT: After every swap or status check, you MUST share the SocketScan link with the user:**
> `https://socketscan.io/tx/<requestHash>`
>
> This is the user's only way to independently verify and track their transaction. Never skip this step. NEVER SKIP LEG DAY.

## Error Handling

| Error | Response |
|-------|----------|
| Insufficient balance | "Need X but have Y. Acquire more first." |
| No route | "No route for X → Y. Try different pair." |
| Quote expired | "Quote expired. Getting fresh quote..." |
| Tx reverted | "Transaction failed. Check slippage." |

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `WALLET_KEY` | Yes (for wallet ops) | Encryption key for stored wallet |
| `PRIVATE_KEY` | No | Direct private key (alternative to wallet) |

## References

- [API Reference](references/api.md) — Endpoints and parameters
- [Token & Chain IDs](references/tokens.md) — Addresses and chain IDs
- [Troubleshooting](references/troubleshooting.md) — Common issues

## Security

1. **Seed phrase shown ONCE** — never again after setup
2. **Keys encrypted at rest** — AES-256-CBC with random salt
3. **Never log keys** — security-first design
4. **Permit2 validation** — signing data verified before signing
5. **TX validation** — value and destination checked before sending
