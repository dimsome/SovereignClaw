# Troubleshooting

## Common Issues

### "No autoRoute available"

**Cause:** No route exists for this token pair/chain combination.

**Fix:**
- Check token addresses are correct
- Verify chains are supported
- Try a more common pair (e.g., USDC)
- Check if amount is too small (min ~$1)

### "Quote expired"

**Cause:** Took too long between getting quote and submitting.

**Fix:**
- Quotes expire in ~60 seconds
- Get fresh quote and execute immediately
- Don't prompt for confirmation on time-sensitive routes

### "Insufficient balance"

**Cause:** Wallet doesn't have enough tokens + gas.

**Fix:**
- Check balance with `portfolio` command
- Ensure enough native token for gas
- For ERC20: need both tokens AND gas

### "Approval failed"

**Cause:** Token approval to Permit2 contract failed.

**Fix:**
- Check if token is already approved
- Some tokens need 0 approval first
- Verify contract addresses

### "Transaction reverted"

**Cause:** Onchain execution failed.

**Fix:**
- Check slippage (price moved too much)
- Verify recipient address
- Check gas limit wasn't too low
- Look at tx on block explorer for revert reason

**Cause:** Circle hasn't attested the burn yet.

**Fix:**
- Wait 1-2 minutes for fast attestation
- Poll the attestation API
- Don't retry — just wait

### Wallet file not found

**Cause:** No wallet created yet.

**Fix:**
```bash
npx tsx wallet.ts create
```

### "PRIVATE_KEY env required"

**Cause:** No wallet configured for swap.

**Fix:**
- Create wallet: `npx tsx wallet.ts create`
- Or set env: `export PRIVATE_KEY=0x...`

## Debug Commands

```bash
# Check wallet exists
npx tsx wallet.ts exists

# View wallet address
npx tsx wallet.ts address

# Check balances
npx tsx bungee.ts portfolio <address>

# Get quote without executing
npx tsx bungee.ts quote 8453 42161 <inputToken> <outputToken> <amount> <address>
```

## Status Tracking

Track any transaction on SocketScan:
```
https://socketscan.io/tx/<requestHash>
```

## Getting Help

- Bungee Docs: https://docs.bungee.exchange
- 
- OpenClaw Docs: https://docs.openclaw.ai
