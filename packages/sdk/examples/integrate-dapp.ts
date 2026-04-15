/**
 * Example: How a dApp integrates GhostGas SDK.
 *
 * This shows the full integration from the dApp developer's perspective.
 * In a real app, this code would live in your React/Next.js frontend.
 *
 * Usage:
 *   npx ts-node examples/integrate-dapp.ts
 */

import { GhostGas } from "../src";

// ── This is what a dApp developer writes ──

const ghost = new GhostGas({
  // Your campaign — get this from the GhostGas dashboard
  campaignAppId: 758809461,

  // Your dApp's Algorand address — you receive 80% of ad revenue
  publisherAddress: "BGO2BBLLBX5KWA7OFXZR423NFCLADRJHDVCAPYEVOC2VPXLEKFFAM5YECE",

  // GhostGas infrastructure (defaults work for local dev)
  agentUrl: "http://localhost:8000",
  sponsorUrl: "http://localhost:3000/api/sponsor",
});

async function main() {
  const userAddress = "BGO2BBLLBX5KWA7OFXZR423NFCLADRJHDVCAPYEVOC2VPXLEKFFAM5YECE";

  console.log("═══ GhostGas SDK Integration Example ═══");
  console.log();

  // Step 1: Check if user needs sponsorship
  const needsGas = await ghost.needsSponsorship(userAddress);
  console.log(`User needs gas sponsorship: ${needsGas}`);

  // Step 2: Check if campaign has budget
  const hasBudget = await ghost.hasBudget();
  console.log(`Campaign has budget: ${hasBudget}`);

  // Step 3: Get campaign details
  const campaign = await ghost.getCampaignInfo();
  console.log(`Campaign budget: ${campaign.budget} impressions`);

  // Step 4: Get user balance
  const balance = await ghost.getBalance(userAddress);
  console.log(`User balance: ${balance / 1_000_000} ALGO`);

  console.log();
  console.log("─── In your React frontend, the full flow looks like: ───");
  console.log();
  console.log(`
  // 1. User clicks "Send" but has 0 ALGO
  if (await ghost.needsSponsorship(userAddress)) {
    // 2. Show the ad modal (15s countdown)
    showAdModal();
  }

  // 3. After ad completes, one function call does everything:
  const txn = await ghost.buildTestTransaction(userAddress);
  const result = await ghost.sponsoredSend(userAddress, txn, peraWallet);

  console.log("Confirmed!", result.txId);
  // User paid 0 ALGO in fees
  `);

  console.log("═══ That's it — 5 lines of code for zero-fee transactions ═══");
}

main().catch(console.error);
