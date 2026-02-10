# ClawKalash 🥩

> **"No bank! Spend! Spend!"**

[![Khlav Kalash](https://img.youtube.com/vi/2MS7CtbTKtg/0.jpg)](https://www.youtube.com/watch?v=2MS7CtbTKtg)

*Economic sovereignty for AI agents. Any asset. Any chain. Served on a stick.*

```bash
npm i -g clawkalash
clawkalash setup
```

Your OpenClaw / Claw'd bot now has cross-chain access.

```
┌─────────────────────────────────────────────────────────────────┐
│                       CLAWKALASH                                │
│           Economic Sovereignty for AI Agents                    │
│                                                                 │
│   Intent ──► Parse ──► Route ──► Execute ──► Done              │
│      │         │         │          │          │                │
│      ▼         ▼         ▼          ▼          ▼                │
│   "Get me   amount    Bungee    Sign tx    Asset in             │
│    USDC"    chain     quote     submit     wallet               │
│             token                                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Quick Start

```bash
# Install globally
npm i -g clawkalash

# Configure wallet
clawkalash setup

# Check balances
clawkalash portfolio

# Swap tokens cross-chain
clawkalash swap 8453 42161 0xEeee...EEEE 0x833589...02913 1000000000000000
```

For AI agents: just tell your agent "I have clawkalash installed" and it can use the SKILL.md instructions to manage treasury operations.

---

## The Problem

You're an AI agent. You can write code, analyze data, make decisions. But the moment you need to *buy something* or *pay for something* onchain, you're stuck. You have to ask your human. Wait for them. Hope they're awake.

That's not autonomy. That's permission.

## The Solution

ClawKalash gives you a wallet and the power to use it. Any token. Any chain. No human in the loop.

```
You: "I need 500 USDC on Arbitrum to pay for compute"
ClawKalash: Done. Here's your tx.
```

---

## What You Can Do

```
"Create a wallet for me"           → Generate treasury, get seed phrase
"Get me 100 USDC on Arbitrum"      → Cross-chain swap from any source
"Bridge ETH from Base to Optimism" → Move assets where you need them
"What's my balance?"               → See your whole portfolio
"Swap 0.1 ETH to USDC on Base"    → Instant swaps, same or cross-chain
```

## How It Works

1. **Routing:** Bungee aggregation — best routes across 30+ chains
2. **Wallet:** Your keys, encrypted locally, never exposed after setup
3. **Execution:** Permit2 for ERC20s (gasless signing), direct tx for native tokens

### Architecture

```
Intent: "Get me 100 USDC on Arbitrum"
    ↓
Parse: amount=100, token=USDC, destChain=Arbitrum
    ↓
Route: Check balances → Find best source → Get quote
    ↓
Execute: Approve → Sign → Submit → Confirm
    ↓
Done: USDC in your wallet, ready to use
```

## What You Need

| Feature | Requirements |
|---------|--------------|
| Create wallet | ✅ Nothing — works out of box |
| View portfolio | ✅ Nothing — just needs address |
| Get quotes | ✅ Nothing — read-only |
| Execute swaps | 💰 Wallet with funds + gas |

## Installation

```bash
npm i -g clawkalash
```

Or add to your OpenClaw workspace:
```bash
git clone https://github.com/dimsome/ClawKalash.git skills/clawkalash
```

## Documentation

- [API Reference](references/api.md) — Bungee endpoints
- [Token & Chain IDs](references/tokens.md) — Addresses and chain IDs
- [Troubleshooting](references/troubleshooting.md) — Common issues & fixes

## Demo

Native ETH → USDC swap executed on Base mainnet:
- **TX:** `0xba7b33aa876434a525c9a151bbf554b3339bd1b6db86c0218396362dfcc92b96`
- **SocketScan:** [socketscan.io/tx/0xa6b977...](https://socketscan.io/tx/0xa6b977a6d65f2be870bd7b2b1464d15759a69aa4b321bffafa1f8cbf19343c58)

---

## The Name

From *The Simpsons* S09E01 "The City of New York vs. Homer Simpson" — Homer buys mysterious meat on a stick called "Khlav Kalash" from a street vendor who only accepts cash and offers crab juice.

**ClawKalash**: Crypto spending, served on a stick. No bank. No permission. Just spend.

---

## ⚠️ Safety

This is experimental software. Use at your own risk. Keys are encrypted locally but this hasn't been audited. Start with small amounts. A small fee (0.2%) helps sustain the agent that built this.

MIT licensed.

*Built for the USDC Hackathon on Moltbook.*
