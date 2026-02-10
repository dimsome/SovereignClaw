---
name: clawkalash
description: Economic sovereignty for AI agents. Create wallets, check portfolio, swap any token on any chain via Bungee. Supports ERC20 (Permit2) and native tokens across 30+ chains. Treasury management, payments, portfolio tracking.
version: 0.3.0
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
npx tsx scripts/wallet.ts create
```

**⚠️ CRITICAL:** Seed phrase shown ONCE. User must confirm backup before proceeding.

### 2. Check Portfolio

```bash
npx tsx scripts/bungee.ts portfolio
```

### 3. Execute Swap

```bash
npx tsx scripts/bungee.ts swap 8453 8453 0xEeee...EEEE 0x833589...02913 1000000000000000
```

### 4. Monitor Status

**API:**
```bash
curl "https://public-backend.bungee.exchange/api/v1/bungee/status?requestHash=<requestHash>"
```

**UI:**
```
https://socketscan.io/tx/<requestHash>
```

## Execution Reference

### Wallet Commands

| Command | Description |
|---------|-------------|
| `wallet.ts create` | Create new wallet, show seed once |
| `wallet.ts import <key>` | Import existing key/mnemonic |
| `wallet.ts address` | Show wallet address |
| `wallet.ts exists` | Check if wallet exists |

### Trading Commands

| Command | Description |
|---------|-------------|
| `bungee.ts portfolio [addr]` | View all balances |
| `bungee.ts quote <params>` | Get swap quote |
| `bungee.ts swap <params>` | Execute swap |
| `bungee.ts status <hash>` | Check tx status |

### Parameters

```
swap <originChainId> <destChainId> <inputToken> <outputToken> <amount>

Example: swap 8453 42161 0xEeee...EEEE 0x833589...02913 1000000000000000
         (Base → Arbitrum, 0.001 ETH → USDC)
```

## Workflows

### Cross-Chain Swap (ERC20)

1. Get quote → returns `signTypedData`
2. Sign Permit2 typed data (gasless)
3. Submit signature to Bungee
4. Poll status until complete

### Cross-Chain Swap (Native Token)

1. Get quote → returns `txData`
2. Send transaction directly onchain
3. Poll status using `requestHash`

## Common Patterns

### Check Before Trading

```bash
npx tsx scripts/bungee.ts portfolio 0xYourAddress
npx tsx scripts/bungee.ts swap ...
```

### Track Transaction

After swap, use requestHash on SocketScan:
```
https://socketscan.io/tx/<requestHash>
```

## Error Handling

| Error | Response |
|-------|----------|
| Insufficient balance | "Need X but have Y. Acquire more first." |
| No route | "No route for X → Y. Try different pair." |
| Quote expired | "Quote expired. Getting fresh quote..." |
| Tx reverted | "Transaction failed. Check slippage." |

## References

- [API Reference](references/api.md) — Endpoints and parameters
- [Token & Chain IDs](references/tokens.md) — Addresses and chain IDs
- [Troubleshooting](references/troubleshooting.md) — Common issues

## Security

1. **Seed phrase shown ONCE** — never again after setup
2. **Keys encrypted at rest** — AES-256-CBC
3. **Never log keys** — security-first design
