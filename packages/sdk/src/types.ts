/**
 * Configuration for the GhostGas SDK.
 */
export interface GhostGasConfig {
  /** Algod server URL (default: testnet) */
  algodServer?: string;
  /** GhostGas agent URL (default: http://localhost:8000) */
  agentUrl?: string;
  /** GhostGas sponsor API URL (default: http://localhost:3000/api/sponsor) */
  sponsorUrl?: string;
  /** Campaign app ID on Algorand */
  campaignAppId: number;
  /** Settlement app ID */
  settlementAppId?: number;
  /** Attestation app ID */
  attestationAppId?: number;
  /** Paymaster app ID */
  paymasterAppId?: number;
  /** Ad duration in seconds (default: 15) */
  adDuration?: number;
  /** Publisher address — the dApp integrating GhostGas (receives 80% of impression revenue) */
  publisherAddress: string;
}

export interface SponsoredResult {
  /** Transaction ID on Algorand */
  txId: string;
  /** Impression ID from settlement (if ad was watched) */
  impressionId: string | null;
  /** Whether an ad was watched for this transaction */
  adWatched: boolean;
}

export interface ImpressionResult {
  success: boolean;
  attestationTxId: string;
  settlementTxId: string;
  impressionId: string | null;
}

export interface CampaignInfo {
  appId: number;
  budget: number;
  advertiser: string;
  costPerImpression: number;
}

export interface ImpressionStatus {
  exists: boolean;
  proofId: string;
  status: number | null;
}

/**
 * Wallet signer interface — any wallet that can sign transaction groups.
 * Compatible with Pera, Defly, Kibisis, etc.
 */
export interface WalletSigner {
  signTransaction(txGroups: Array<Array<{ txn: any }>>): Promise<Uint8Array[]>;
}
