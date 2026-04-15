import { NextResponse } from "next/server";
import { getServiceSupabase } from "../../../lib/supabase";

export async function GET() {
  try {
    const sb = getServiceSupabase();

    // Run queries in parallel
    const [impressionsRes, sponsoredRes, usersRes, campaignRes] =
      await Promise.all([
        sb
          .from("impressions")
          .select("*", { count: "exact", head: true }),
        sb
          .from("sponsored_txns")
          .select("*", { count: "exact", head: true }),
        sb
          .from("users")
          .select("*", { count: "exact", head: true }),
        sb
          .from("impressions")
          .select("publisher_earned_micro_algo, protocol_fee_micro_algo, amount_micro_algo"),
      ]);

    // Sum up earnings
    let totalPublisherEarned = 0;
    let totalProtocolFees = 0;
    let totalSettled = 0;
    for (const row of campaignRes.data ?? []) {
      totalPublisherEarned += row.publisher_earned_micro_algo;
      totalProtocolFees += row.protocol_fee_micro_algo;
      totalSettled += row.amount_micro_algo;
    }

    return NextResponse.json({
      totalImpressions: impressionsRes.count ?? 0,
      totalSponsoredTxns: sponsoredRes.count ?? 0,
      totalUsers: usersRes.count ?? 0,
      totalSettledMicroAlgo: totalSettled,
      totalPublisherEarnedMicroAlgo: totalPublisherEarned,
      totalProtocolFeesMicroAlgo: totalProtocolFees,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
