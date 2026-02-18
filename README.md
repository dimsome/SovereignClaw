# ClawKalash 🥩 

> *Economic sovereignty for AI agents. Any asset. Any chain. Served on a stick.*

**"No bank. No permission. Just Swap! Swap! Swap!"**

[![Khlav Kalash](https://img.youtube.com/vi/2MS7CtbTKtg/0.jpg)](https://www.youtube.com/watch?v=2MS7CtbTKtg)



```bash
npm i -g clawkalash
export WALLET_KEY="your-secret-key"
ck wallet-create
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

# Create wallet (WALLET_KEY required)
export WALLET_KEY="your-secret-key"
ck wallet-create

# Or import existing key via stdin
echo "0xprivatekey" | ck wallet-import

# Check balances
ck portfolio

# Swap tokens cross-chain
ck swap 8453 42161 0xEeee...EEEE 0x833589...02913 1000000000000000
```

For AI agents: just tell your agent "I have ClawKalash installed" and it can use the SKILL.md instructions to manage treasury operations.

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

## ⚠️ Disclaimer & Risk Warning

> **THIS SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.**

**🚨 EXPERIMENTAL SOFTWARE — USE AT YOUR OWN RISK 🚨**

- **Not audited.** This code has not undergone any formal security audit. There may be vulnerabilities that could result in loss of funds.
- **Real money at risk.** This tool interacts with real blockchain networks and real tokens. Transactions are **irreversible**. Once funds are sent, they cannot be recovered.
- **Private key management.** While keys are encrypted at rest (AES-256-CBC), the encryption has not been independently verified. Never use this with keys controlling significant funds.
- **Third-party dependency.** This tool relies on the [Bungee Exchange](https://bungee.exchange) API for routing and execution. We have no control over their infrastructure, uptime, or routing decisions.
- **No financial advice.** Nothing in this project constitutes financial, investment, or trading advice.
- **Start small.** If you choose to use this, start with trivial amounts you can afford to lose completely.
- **AI agents make mistakes.** This tool is designed to be operated by AI agents. AI can hallucinate, misinterpret instructions, or execute unintended actions. Always review transactions and double-check everything before and after execution.

**By using this software, you acknowledge that you understand these risks and accept full responsibility for any losses incurred.**

A small fee (0.2%) is applied to swaps to help sustain development.

---

MIT licensed.
