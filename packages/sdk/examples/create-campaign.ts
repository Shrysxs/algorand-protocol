/**
 * Example: Create and fund a GhostGas campaign.
 *
 * Usage:
 *   npx ts-node examples/create-campaign.ts
 *
 * Required env vars:
 *   MNEMONIC           — 25-word Algorand mnemonic (advertiser account)
 *   CAMPAIGN_APP_ID    — deployed CampaignV2 contract app ID
 */

import { GhostGasAdmin } from "../src";

const MNEMONIC = process.env.MNEMONIC ?? "";
const CAMPAIGN_APP_ID = Number(process.env.CAMPAIGN_APP_ID ?? "758809461");
const BUDGET = Number(process.env.BUDGET ?? "50"); // 50 impressions

async function main() {
  if (!MNEMONIC) {
    console.error("Set MNEMONIC env var to your 25-word Algorand mnemonic");
    process.exit(1);
  }

  const admin = new GhostGasAdmin({
    campaignAppId: CAMPAIGN_APP_ID,
    publisherAddress: "", // not needed for admin ops
    mnemonic: MNEMONIC,
  });

  console.log(`Admin address: ${admin.address}`);
  console.log(`Campaign app ID: ${CAMPAIGN_APP_ID}`);
  console.log();

  // Check current budget
  const before = await admin.getCampaignInfo();
  console.log(`Current budget: ${before.budget} impressions`);

  // Deposit budget
  console.log(`Depositing ${BUDGET} impressions...`);
  const txId = await admin.depositBudget(BUDGET);
  console.log(`Deposit tx: ${txId}`);

  // Verify
  const after = await admin.getCampaignInfo();
  console.log(`New budget: ${after.budget} impressions`);
  console.log();
  console.log("Campaign funded successfully!");
  console.log(`View on explorer: https://testnet.explorer.perawallet.app/application/${CAMPAIGN_APP_ID}`);
}

main().catch(console.error);
