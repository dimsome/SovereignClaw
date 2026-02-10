# Token & Chain Reference

## Dynamic Token List

Get real-time token balances and supported tokens from the Bungee API:

```bash
# Get all tokens with balances for an address
curl "https://public-backend.bungee.exchange/api/v1/tokens/list?userAddress=0x..."
```

This returns tokens across all supported chains with current balances — no need for static lists.

## Common Chain IDs

| Chain | ID | Native Token |
|-------|------|--------------|
| Ethereum | 1 | ETH |
| Base | 8453 | ETH |
| Arbitrum | 42161 | ETH |
| Optimism | 10 | ETH |
| Polygon | 137 | MATIC |
| Avalanche | 43114 | AVAX |
| BSC | 56 | BNB |

## Native Token Address

All chains use the same address for native token:
```
0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE
```

## USDC Addresses

### Mainnet
| Chain | Address |
|-------|---------|
| Ethereum | 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48 |
| Base | 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 |
| Arbitrum | 0xaf88d065e77c8cC2239327C5EDb3A432268e5831 |
| Optimism | 0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85 |
| Polygon | 0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359 |

