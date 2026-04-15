import algosdk from "algosdk";
import type {
  GhostGasConfig,
  SponsoredResult,
  ImpressionResult,
  CampaignInfo,
  ImpressionStatus,
  WalletSigner,
} from "./types";
import { campaignABI } from "./abi";

/**
 * GhostGas SDK — drop into any Algorand dApp for ad-sponsored gas.
 *
 * @example
 * ```ts
 * import { GhostGas } from "@ghostgas/sdk";
 *
 * const ghost = new GhostGas({
 *   campaignAppId: 758809461,
 *   publisherAddress: "YOUR_DAPP_ADDRESS...",
 *   agentUrl: "https://agent.ghostgas.xyz",
 *   sponsorUrl: "https://api.ghostgas.xyz/sponsor",
 * });
 *
 * // Check if user needs gas sponsorship
 * const needsGas = await ghost.needsSponsorship(userAddress);
 *
 * // Check if campaign has budget
 * const hasBudget = await ghost.hasBudget();
 *
 * // Full sponsored send: ad → settle → sponsor → sign → confirm
 * const result = await ghost.sponsoredSend(userTxn, wallet);
 * console.log(result.txId); // confirmed on-chain
 * ```
 */
export class GhostGas {
  private client: algosdk.Algodv2;
  private config: Required<
    Pick<GhostGasConfig, "agentUrl" | "sponsorUrl" | "campaignAppId" | "publisherAddress" | "adDuration">
  > &
    GhostGasConfig;

  constructor(config: GhostGasConfig) {
    const algodServer = config.algodServer ?? "https://testnet-api.algonode.cloud";
    this.client = new algosdk.Algodv2("", algodServer, "");
    this.config = {
      agentUrl: "http://localhost:8000",
      sponsorUrl: "http://localhost:3000/api/sponsor",
      adDuration: 15,
      ...config,
    };
  }

  // ────────────────────────────────────────────────────────────────────────
  // Public API
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Check if a user needs gas sponsorship (balance < min fee).
   */
  async needsSponsorship(userAddress: string): Promise<boolean> {
    try {
      const info = await this.client.accountInformation(userAddress).do();
      return Number(info.amount ?? 0) < 1000;
    } catch {
      return true;
    }
  }

  /**
   * Check if the campaign still has budget for impressions.
   */
  async hasBudget(): Promise<boolean> {
    try {
      const info = await this.getCampaignInfo();
      return info.budget > 0;
    } catch {
      return false;
    }
  }

  /**
   * Get campaign details from on-chain state.
   */
  async getCampaignInfo(): Promise<CampaignInfo> {
    const appInfo = await this.client
      .getApplicationByID(this.config.campaignAppId)
      .do();
    const gs = (appInfo as any).params?.globalState ?? (appInfo as any).params?.["global-state"] ?? [];

    const state: Record<string, any> = {};
    for (const kv of gs) {
      const key = Buffer.from(kv.key ?? kv.Key, "base64").toString();
      const val = kv.value ?? kv.Value;
      state[key] = val.type === 1 ? Buffer.from(val.bytes, "base64").toString("hex") : val.uint;
    }

    return {
      appId: this.config.campaignAppId,
      budget: Number(state["budget"] ?? 0),
      advertiser: String(state["advertiser"] ?? ""),
      costPerImpression: Number(state["cost_per_impression"] ?? 1),
    };
  }

  /**
   * Check the status of an impression proof.
   */
  async getImpressionStatus(proofIdHex: string): Promise<ImpressionStatus> {
    if (!this.config.attestationAppId) {
      throw new Error("attestationAppId not configured");
    }
    const proofBytes = Buffer.from(proofIdHex, "hex");
    const boxName = new Uint8Array(Buffer.concat([Buffer.from("proof:"), proofBytes]));

    try {
      const box = await this.client
        .getApplicationBoxByName(this.config.attestationAppId, boxName)
        .do();
      const status = new DataView(new Uint8Array(box.value).buffer).getBigUint64(0);
      return { exists: true, proofId: proofIdHex, status: Number(status) };
    } catch {
      return { exists: false, proofId: proofIdHex, status: null };
    }
  }

  /**
   * Record an ad impression via the GhostGas agent.
   * Call this after the user has watched the ad for the required duration.
   */
  async recordImpression(userAddress: string, proofIdHex: string): Promise<ImpressionResult> {
    const res = await fetch(`${this.config.agentUrl}/impression/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_address: userAddress,
        proof_id: proofIdHex,
        publisher_address: this.config.publisherAddress,
        duration_seconds: this.config.adDuration,
      }),
    });

    if (res.status === 402) {
      throw new GhostGasError("BUDGET_EXHAUSTED", "Campaign budget exhausted");
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new GhostGasError(
        "AGENT_ERROR",
        data.detail ?? data.error ?? `Agent returned ${res.status}`
      );
    }

    const data = await res.json();
    return {
      success: true,
      attestationTxId: data.attestation_tx_id,
      settlementTxId: data.settlement_tx_id,
      impressionId: data.impression_id ?? null,
    };
  }

  /**
   * Wrap a user transaction with fee sponsorship.
   * Returns grouped transactions — sponsor signed, user unsigned.
   */
  async buildSponsoredGroup(
    userAddress: string,
    userTxn: algosdk.Transaction,
    impressionId?: string | null
  ): Promise<{ signedSponsorTxn: Uint8Array; unsignedUserTxn: algosdk.Transaction }> {
    const txnBytes = Buffer.from(algosdk.encodeUnsignedTransaction(userTxn)).toString("base64");

    const res = await fetch(this.config.sponsorUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userAddress, txnBytes, impressionId }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new GhostGasError("SPONSOR_ERROR", data.error ?? "Sponsor API failed");
    }

    const { groupTxns } = await res.json();
    return {
      signedSponsorTxn: new Uint8Array(Buffer.from(groupTxns[0], "base64")),
      unsignedUserTxn: algosdk.decodeUnsignedTransaction(
        Buffer.from(groupTxns[1], "base64")
      ),
    };
  }

  /**
   * Full flow: record impression → build sponsored group → sign → submit.
   *
   * This is the main method dApps call. It handles everything:
   * 1. Generates a proof ID
   * 2. Calls the agent to settle the impression
   * 3. Wraps the user's transaction with fee sponsorship
   * 4. Has the user sign via their wallet
   * 5. Submits and confirms on-chain
   */
  async sponsoredSend(
    userAddress: string,
    userTxn: algosdk.Transaction,
    wallet: WalletSigner
  ): Promise<SponsoredResult> {
    // 1. Generate proof + settle impression
    const proofId = this.generateProofId();
    const impression = await this.recordImpression(userAddress, proofId);

    // 2. Build fee-sponsored group
    const { signedSponsorTxn, unsignedUserTxn } = await this.buildSponsoredGroup(
      userAddress,
      userTxn,
      impression.impressionId
    );

    // 3. User signs their transaction
    const signedUserTxns = await wallet.signTransaction([[{ txn: unsignedUserTxn }]]);

    // 4. Submit group
    const signedGroup = [signedSponsorTxn, signedUserTxns[0]];
    const { txid } = await this.client.sendRawTransaction(signedGroup).do();
    await algosdk.waitForConfirmation(this.client, txid, 4);

    return {
      txId: txid,
      impressionId: impression.impressionId,
      adWatched: true,
    };
  }

  /**
   * Build a simple 0-ALGO self-payment for testing.
   */
  async buildTestTransaction(userAddress: string): Promise<algosdk.Transaction> {
    const params = await this.client.getTransactionParams().do();
    return algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: userAddress,
      receiver: userAddress,
      amount: BigInt(0),
      suggestedParams: { ...params, fee: BigInt(0), flatFee: true },
    });
  }

  /**
   * Get the user's ALGO balance in microALGO.
   */
  async getBalance(userAddress: string): Promise<number> {
    try {
      const info = await this.client.accountInformation(userAddress).do();
      return Number(info.amount ?? 0);
    } catch {
      return 0;
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // Internals
  // ────────────────────────────────────────────────────────────────────────

  private generateProofId(): string {
    const bytes = new Uint8Array(16);
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
}

/**
 * GhostGas-specific error with error codes.
 */
export class GhostGasError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "GhostGasError";
  }
}
