/**
 * Example: Check an impression proof on-chain and get campaign status.
 *
 * Usage:
 *   npx ts-node examples/check-impression.ts
 *   npx ts-node examples/check-impression.ts <proof_id_hex>
 *
 * Required env vars:
 *   MNEMONIC             — 25-word Algorand mnemonic
 *   CAMPAIGN_APP_ID      — deployed CampaignV2 app ID
 *   ATTESTATION_APP_ID   — deployed AttestationV2 app ID
 */

import { GhostGasAdmin } from "../src";

const MNEMONIC = process.env.MNEMONIC ?? "";
const CAMPAIGN_APP_ID = Number(process.env.CAMPAIGN_APP_ID ?? "758809461");
const ATTESTATION_APP_ID = Number(process.env.ATTESTATION_APP_ID ?? "758809473");

async function main() {
  if (!MNEMONIC) {
    console.error("Set MNEMONIC env var");
    process.exit(1);
  }

  const proofId = process.argv[2] ?? null;

  const admin = new GhostGasAdmin({
    campaignAppId: CAMPAIGN_APP_ID,
    attestationAppId: ATTESTATION_APP_ID,
    publisherAddress: "",
    mnemonic: MNEMONIC,
  });

  // ── Campaign Status ──
  console.log("═══ Campaign Status ═══");
  const campaign = await admin.getCampaignInfo();
  console.log(`  App ID:              ${campaign.appId}`);
  console.log(`  Budget remaining:    ${campaign.budget} impressions`);
  console.log(`  Cost per impression: ${campaign.costPerImpression}`);
  console.log();

  // ── On-chain budget via ABI call ──
  const budget = await admin.getBudget();
  console.log(`  Budget (ABI call):   ${budget}`);
  console.log();

  // ── Check specific proof ──
  if (proofId) {
    console.log(`═══ Impression Proof ═══`);
    console.log(`  Proof ID: ${proofId}`);
    const status = await admin.checkImpression(ATTESTATION_APP_ID, proofId);
    if (status.exists) {
      console.log(`  Status:   EXISTS (value=${status.status})`);
      console.log(`  Meaning:  Proof is recorded and NOT yet consumed`);
    } else {
      console.log(`  Status:   NOT FOUND`);
      console.log(`  Meaning:  Either never recorded, or already consumed by settlement`);
    }
  } else {
    console.log("Tip: pass a proof ID as argument to check a specific impression:");
    console.log("  npx ts-node examples/check-impression.ts abc123def456...");
  }
}

main().catch(console.error);
