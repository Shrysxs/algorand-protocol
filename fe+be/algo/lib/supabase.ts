import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://pplfvsxxyjnafppllopd.supabase.co";

// Browser client — lazy-initialized so missing key doesn't crash at build
let _browserClient: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_browserClient) {
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!key) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY not set");
    _browserClient = createClient(supabaseUrl, key);
  }
  return _browserClient;
}

// Server client (uses service role key, bypasses RLS) — lazy
let _serviceClient: SupabaseClient | null = null;

export function getServiceSupabase(): SupabaseClient {
  if (!_serviceClient) {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY not set");
    _serviceClient = createClient(supabaseUrl, serviceKey);
  }
  return _serviceClient;
}

// ---------------------------------------------------------------------------
// DB helper types
// ---------------------------------------------------------------------------

export interface DBCampaign {
  id: string;
  app_id: number;
  advertiser_address: string;
  name: string;
  ad_creative_url: string | null;
  budget_total: number;
  budget_remaining: number;
  cost_per_impression_usdc: number;
  status: "active" | "paused" | "exhausted";
  created_at: string;
  updated_at: string;
}

export interface DBImpression {
  id: string;
  campaign_id: string | null;
  user_address: string;
  publisher_address: string;
  proof_id: string;
  duration_seconds: number;
  attestation_tx_id: string | null;
  settlement_tx_id: string | null;
  amount_micro_algo: number;
  publisher_earned_micro_algo: number;
  protocol_fee_micro_algo: number;
  settled_at: string;
}

export interface DBSponsoredTxn {
  id: string;
  user_address: string;
  sponsor_tx_id: string | null;
  user_tx_id: string | null;
  fee_paid_micro_algo: number;
  impression_id: string | null;
  created_at: string;
}

export interface DBUser {
  id: string;
  address: string;
  total_impressions: number;
  total_sponsored_txns: number;
  first_seen: string;
  last_seen: string;
}
