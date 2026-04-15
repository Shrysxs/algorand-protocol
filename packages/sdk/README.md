# @ghostgas/sdk

Ad-sponsored gas abstraction for Algorand dApps. Drop in 5 lines of code and your users never pay transaction fees.

## Install

```bash
npm install @ghostgas/sdk algosdk
```

## Quick Start (dApp Integration)

```ts
import { GhostGas } from "@ghostgas/sdk";

const ghost = new GhostGas({
  campaignAppId: 758809461,
  publisherAddress: "YOUR_DAPP_ADDRESS...", // you get 80% of ad revenue
});

// Check if user needs sponsorship
if (await ghost.needsSponsorship(userAddress)) {
  // Show your ad modal (15s countdown)
  await showAdModal();
}

// One call: settle impression → sponsor fee → sign → confirm
const txn = await ghost.buildTestTransaction(userAddress);
const result = await ghost.sponsoredSend(userAddress, txn, peraWallet);
console.log("Confirmed!", result.txId); // user paid 0 fees
```

## Campaign Management

```ts
import { GhostGasAdmin } from "@ghostgas/sdk";

const admin = new GhostGasAdmin({
  campaignAppId: 758809461,
  publisherAddress: "",
  mnemonic: "your 25-word mnemonic...",
});

// Fund a campaign with 100 impression slots
await admin.depositBudget(100);

// Check budget
const info = await admin.getCampaignInfo();
console.log(`${info.budget} impressions remaining`);

// Check if a specific impression was recorded
const status = await admin.checkImpression(attestationAppId, "proof_id_hex");
console.log(status.exists ? "Proof exists" : "Proof consumed or not found");
```

## API Reference

### `GhostGas` (User-facing)

| Method | Description |
|---|---|
| `needsSponsorship(addr)` | Returns `true` if user balance < min fee |
| `hasBudget()` | Returns `true` if campaign has impressions left |
| `getCampaignInfo()` | Get on-chain campaign state |
| `getBalance(addr)` | Get user ALGO balance (microALGO) |
| `getImpressionStatus(proofId)` | Check if a proof exists in attestation box storage |
| `recordImpression(addr, proofId)` | Tell the agent to settle an impression |
| `buildSponsoredGroup(addr, txn)` | Wrap a txn with fee pooling |
| `sponsoredSend(addr, txn, wallet)` | Full flow: settle + sponsor + sign + submit |
| `buildTestTransaction(addr)` | Build a 0-ALGO self-payment for testing |

### `GhostGasAdmin` (Campaign management)

| Method | Description |
|---|---|
| `depositBudget(amount)` | Add impressions to campaign budget |
| `getCampaignInfo()` | Read campaign state from chain |
| `getBudget()` | Get budget via ABI call |
| `fundPaymaster(appId, amount)` | Fund paymaster with ALGO |
| `setupSettlement(ids)` | Link contracts to settlement (one-time) |
| `checkImpression(appId, proofId)` | Check attestation box for a proof |

## How It Works

```
User (0 ALGO) → Watch 15s ad → Agent settles on-chain → Sponsor wraps tx → User signs → Confirmed (0 fees)
```

The SDK handles the entire pipeline. Your dApp just shows the ad and calls `sponsoredSend`.
