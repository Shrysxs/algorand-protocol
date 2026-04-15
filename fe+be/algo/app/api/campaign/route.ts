import { NextRequest, NextResponse } from "next/server";
import algosdk from "algosdk";
import { getAlgodClient, adminAccountFromKey } from "../../../lib/algod";
import { depositBudget } from "../../../lib/contracts";
import { getServiceSupabase } from "../../../lib/supabase";

const CAMPAIGN_APP_ID = Number(process.env.CAMPAIGN_APP_ID ?? "0");

export async function GET() {
  try {
    if (!CAMPAIGN_APP_ID) {
      return NextResponse.json(
        { error: "CAMPAIGN_APP_ID not configured" },
        { status: 500 }
      );
    }

    // Try Supabase first for richer data
    try {
      const sb = getServiceSupabase();
      const { data } = await sb
        .from("campaigns")
        .select("*")
        .eq("app_id", CAMPAIGN_APP_ID)
        .single();

      if (data) {
        // Also fetch live on-chain budget
        const client = getAlgodClient();
        const appInfo = await client.getApplicationByID(CAMPAIGN_APP_ID).do();
        const globalState =
          (appInfo as any).params?.globalState ??
          (appInfo as any).params?.["global-state"] ??
          [];

        let onChainBudget = 0;
        for (const kv of globalState) {
          const key = Buffer.from(kv.key ?? kv.Key, "base64").toString();
          if (key === "budget") {
            onChainBudget = Number((kv.value ?? kv.Value).uint);
          }
        }

        // Fetch impression count
        const { count } = await sb
          .from("impressions")
          .select("*", { count: "exact", head: true })
          .eq("campaign_id", data.id);

        return NextResponse.json({
          appId: CAMPAIGN_APP_ID,
          name: data.name,
          budget: onChainBudget,
          budgetTotal: data.budget_total,
          costPerImpressionUsdc: data.cost_per_impression_usdc,
          status: data.status,
          totalImpressions: count ?? 0,
          advertiser: data.advertiser_address,
          adCreativeUrl: data.ad_creative_url,
        });
      }
    } catch {
      // Supabase not configured or campaign not in DB — fall through to on-chain only
    }

    // Fallback: read directly from chain
    const client = getAlgodClient();
    const appInfo = await client.getApplicationByID(CAMPAIGN_APP_ID).do();
    const globalState =
      (appInfo as any).params?.globalState ??
      (appInfo as any).params?.["global-state"] ??
      [];

    const state: Record<string, string | number> = {};
    for (const kv of globalState) {
      const keyB64 = kv.key ?? kv.Key;
      const key = Buffer.from(keyB64, "base64").toString();
      const val = kv.value ?? kv.Value;
      if (val.type === 1) {
        state[key] = Buffer.from(val.bytes, "base64").toString("hex");
      } else {
        state[key] = Number(val.uint);
      }
    }

    // Try to get adCreativeUrl from Supabase even in fallback path
    let adCreativeUrl: string | null = null;
    try {
      const sb = getServiceSupabase();
      const { data: row } = await sb
        .from("campaigns")
        .select("ad_creative_url")
        .eq("app_id", CAMPAIGN_APP_ID)
        .single();
      if (row?.ad_creative_url) adCreativeUrl = row.ad_creative_url;
    } catch {
      // no supabase or no row
    }

    return NextResponse.json({
      appId: CAMPAIGN_APP_ID,
      budget: state["budget"] ?? 0,
      advertiser: state["advertiser"] ?? "",
      costPerImpression: state["cost_per_impression"] ?? 1,
      adCreativeUrl,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!CAMPAIGN_APP_ID) {
      return NextResponse.json(
        { error: "CAMPAIGN_APP_ID not configured" },
        { status: 500 }
      );
    }

    const { amount, name, adCreativeUrl } = (await req.json()) as {
      amount: number;
      name?: string;
      adCreativeUrl?: string;
    };
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: "amount must be a positive number" },
        { status: 400 }
      );
    }

    const client = getAlgodClient();
    const admin = adminAccountFromKey();
    const signer = algosdk.makeBasicAccountTransactionSigner(admin);

    const result = await depositBudget(
      client,
      admin.addr.toString(),
      signer,
      CAMPAIGN_APP_ID,
      amount
    );

    // Log to Supabase
    try {
      const sb = getServiceSupabase();
      await sb.from("campaigns").upsert(
        {
          app_id: CAMPAIGN_APP_ID,
          advertiser_address: admin.addr.toString(),
          name: name ?? "GhostGas Demo Campaign",
          ad_creative_url: adCreativeUrl ?? null,
          budget_total: amount,
          budget_remaining: amount,
          status: "active",
        },
        { onConflict: "app_id" }
      );
    } catch {
      // best-effort
    }

    return NextResponse.json({
      success: true,
      txId: result.txIDs[0],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
