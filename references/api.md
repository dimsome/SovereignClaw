# Bungee API Reference

## Base URL
```
https://public-backend.bungee.exchange
```

## Endpoints

### Get Quote
```
GET /api/v1/bungee/quote
```

**Parameters:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| userAddress | address | ✓ | Sender wallet |
| receiverAddress | address | ✓ | Recipient (usually same) |
| originChainId | number | ✓ | Source chain |
| destinationChainId | number | ✓ | Destination chain |
| inputToken | address | ✓ | Token to send |
| outputToken | address | ✓ | Token to receive |
| inputAmount | string | ✓ | Amount in wei |
| feeTakerAddress | address | | Fee recipient |
| feeBps | string | | Fee in basis points |

**Response:**
```json
{
  "success": true,
  "result": {
    "autoRoute": {
      "quoteId": "abc123",
      "requestType": "SWAP_REQUEST",
      "signTypedData": { ... },  // For ERC20 permit2
      "txData": { ... },         // For native tokens
      "outputAmount": "1000000"
    }
  }
}
```

### Submit Transaction
```
POST /api/v1/bungee/submit
```

**Body (ERC20 via permit2):**
```json
{
  "requestType": "SWAP_REQUEST",
  "request": { ... },        // witness from signTypedData
  "userSignature": "0x...",  // EIP-712 signature
  "quoteId": "abc123"
}
```

**Body (Native token):**
Not needed — execute txData directly onchain.

### Check Status
```
GET /api/v1/bungee/status?requestHash=0x...
```

**Response:**
```json
{
  "success": true,
  "result": [{
    "bungeeStatusCode": 3,  // 3 = complete
    "originData": { "txHash": "0x..." },
    "destinationData": { "txHash": "0x..." }
  }]
}
```

**Status Codes:**
| Code | Meaning |
|------|---------|
| 1 | Pending |
| 2 | In Progress |
| 3 | Completed (success) |
| 4 | Completed (partial) |
| 5 | Expired |
| 6 | Cancelled |
| 7 | Refunded |

### Get Token Balances
```
GET /api/v1/tokens/list?userAddress=0x...
```

Returns all token balances across supported chains.

**Response:**
```json
{
  "success": true,
  "result": {
    "8453": [
      {
        "address": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        "symbol": "USDC",
        "decimals": 6,
        "balance": "1000000",
        "balanceInUsd": 1.0
      }
    ],
    "42161": [ ... ]
  }
}
```

**Use this for:**
- Portfolio view across all chains
- Finding which tokens/chains user has
- No need for static token lists

