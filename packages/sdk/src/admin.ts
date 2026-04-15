import algosdk from "algosdk";
import { campaignABI, attestationABI, paymasterABI, settlementABI } from "./abi";
import type { GhostGasConfig, CampaignInfo } from "./types";

/**
 * GhostGas Admin SDK — for campaign management and protocol setup.
 *
 * @example
 * ```ts
 * import { GhostGasAdmin } from "@ghostgas/sdk";
 *
 * const admin = new GhostGasAdmin({
 *   campaignAppId: 758809461,
 *   mnemonic: "your 25-word mnemonic...",
 * });
 *
 * // Create/fund a campaign
 * await admin.depositBudget(100); // 100 impressions
 *
 * // Check budget
 * const info = await admin.getCampaignInfo();
 * console.log(`Budget: ${info.budget} impressions left`);
 *
 * // Link contracts (one-time setup)
 * await admin.setupSettlement({
 *   settlementAppId: 758809462,
 *   attestationAppId: 758809473,
 *   paymasterAppId: 758809463,
 * });
 * ```
 */
export class GhostGasAdmin {
  private client: algosdk.Algodv2;
  private account: algosdk.Account;
  private signer: algosdk.TransactionSigner;
  private config: GhostGasConfig & { mnemonic: string };

  constructor(config: GhostGasConfig & { mnemonic: string }) {
    const algodServer = config.algodServer ?? "https://testnet-api.algonode.cloud";
    this.client = new algosdk.Algodv2("", algodServer, "");
    this.account = algosdk.mnemonicToSecretKey(config.mnemonic);
    this.signer = algosdk.makeBasicAccountTransactionSigner(this.account);
    this.config = config;
  }

  /**
   * Get the admin's Algorand address.
   */
  get address(): string {
    return this.account.addr.toString();
  }

  // ────────────────────────────────────────────────────────────────────────
  // Campaign Management
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Deposit budget into a campaign (number of impressions).
   */
  async depositBudget(amount: number): Promise<string> {
    const atc = new algosdk.AtomicTransactionComposer();
    const params = await this.client.getTransactionParams().do();
    atc.addMethodCall({
      appID: this.config.campaignAppId,
      method: campaignABI.getMethodByName("deposit_budget"),
      methodArgs: [amount],
      sender: this.address,
      suggestedParams: params,
      signer: this.signer,
    });
    const result = await atc.execute(this.client, 4);
    return result.txIDs[0];
  }

  /**
   * Get current campaign info from on-chain state.
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
   * Get the remaining campaign budget.
   */
  async getBudget(): Promise<number> {
    const atc = new algosdk.AtomicTransactionComposer();
    const params = await this.client.getTransactionParams().do();
    atc.addMethodCall({
      appID: this.config.campaignAppId,
      method: campaignABI.getMethodByName("get_budget"),
      methodArgs: [],
      sender: this.address,
      suggestedParams: params,
      signer: this.signer,
    });
    const result = await atc.execute(this.client, 4);
    return Number(result.methodResults[0].returnValue as bigint);
  }

  // ────────────────────────────────────────────────────────────────────────
  // Paymaster Management
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Fund the paymaster contract with ALGO for sponsorship.
   */
  async fundPaymaster(paymasterAppId: number, amount: number): Promise<string> {
    const atc = new algosdk.AtomicTransactionComposer();
    const params = await this.client.getTransactionParams().do();
    atc.addMethodCall({
      appID: paymasterAppId,
      method: paymasterABI.getMethodByName("fund"),
      methodArgs: [amount],
      sender: this.address,
      suggestedParams: params,
      signer: this.signer,
    });
    const result = await atc.execute(this.client, 4);
    return result.txIDs[0];
  }

  // ────────────────────────────────────────────────────────────────────────
  // Settlement Setup (one-time)
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Link all contracts to the settlement orchestrator. One-time setup.
   */
  async setupSettlement(ids: {
    settlementAppId: number;
    attestationAppId: number;
    paymasterAppId: number;
  }): Promise<{ setCampaignTx: string; setAttestationTx: string; setPaymasterTx: string }> {
    const params = await this.client.getTransactionParams().do();

    const call = async (method: string, arg: number) => {
      const atc = new algosdk.AtomicTransactionComposer();
      atc.addMethodCall({
        appID: ids.settlementAppId,
        method: settlementABI.getMethodByName(method),
        methodArgs: [arg],
        sender: this.address,
        suggestedParams: params,
        signer: this.signer,
      });
      const r = await atc.execute(this.client, 4);
      return r.txIDs[0];
    };

    const setCampaignTx = await call("set_campaign", this.config.campaignAppId);
    const setAttestationTx = await call("set_attestation", ids.attestationAppId);
    const setPaymasterTx = await call("set_paymaster", ids.paymasterAppId);

    return { setCampaignTx, setAttestationTx, setPaymasterTx };
  }

  // ────────────────────────────────────────────────────────────────────────
  // Impression Checking
  // ────────────────────────────────────────────────────────────────────────

  /**
   * Check if an attestation proof exists on-chain.
   */
  async checkImpression(
    attestationAppId: number,
    proofIdHex: string
  ): Promise<{ exists: boolean; status: number | null }> {
    const proofBytes = Buffer.from(proofIdHex, "hex");
    const boxName = new Uint8Array(Buffer.concat([Buffer.from("proof:"), proofBytes]));

    try {
      const box = await this.client
        .getApplicationBoxByName(attestationAppId, boxName)
        .do();
      const status = new DataView(new Uint8Array(box.value).buffer).getBigUint64(0);
      return { exists: true, status: Number(status) };
    } catch {
      return { exists: false, status: null };
    }
  }
}
