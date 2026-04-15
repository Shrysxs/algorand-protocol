"use client";

import { useCallback, useEffect, useState } from "react";

interface Stats {
  totalImpressions: number;
  totalSponsoredTxns: number;
  totalUsers: number;
  totalSettledMicroAlgo: number;
  totalPublisherEarnedMicroAlgo: number;
  totalProtocolFeesMicroAlgo: number;
}

interface Campaign {
  appId: number;
  budget: number;
  name?: string;
  status?: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [s, c] = await Promise.all([
        fetch("/api/stats").then((r) => r.ok ? r.json() : null).catch(() => null),
        fetch("/api/campaign").then((r) => r.ok ? r.json() : null).catch(() => null),
      ]);
      if (s) setStats(s);
      if (c) setCampaign(c);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); const i = setInterval(fetchData, 10000); return () => clearInterval(i); }, [fetchData]);

  const algo = (n: number) => (n / 1_000_000).toFixed(4);

  if (loading) return <div className="flex-1 flex items-center justify-center"><div className="w-4 h-4 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="flex-1 px-5 lg:px-8 py-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-[13px] text-zinc-400 mt-0.5">Protocol stats, updated every 10s</p>
        </div>

        {/* Top stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-zinc-100 rounded-lg overflow-hidden border border-zinc-100 mb-4">
          {[
            { l: "Impressions", v: stats?.totalImpressions ?? 0 },
            { l: "Sponsored Txns", v: stats?.totalSponsoredTxns ?? 0 },
            { l: "Users", v: stats?.totalUsers ?? 0 },
            { l: "Budget Left", v: campaign?.budget ?? 0 },
          ].map((s) => (
            <div key={s.l} className="bg-white p-5">
              <p className="text-2xl font-bold">{s.v}</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">{s.l}</p>
            </div>
          ))}
        </div>

        {/* Revenue */}
        <div className="grid grid-cols-3 gap-px bg-zinc-100 rounded-lg overflow-hidden border border-zinc-100 mb-4">
          {[
            { l: "Total Settled", v: algo(stats?.totalSettledMicroAlgo ?? 0), u: "ALGO" },
            { l: "Publisher Earned", v: algo(stats?.totalPublisherEarnedMicroAlgo ?? 0), u: "ALGO (80%)" },
            { l: "Protocol Fees", v: algo(stats?.totalProtocolFeesMicroAlgo ?? 0), u: "ALGO (20%)" },
          ].map((s) => (
            <div key={s.l} className="bg-white p-5">
              <p className="text-xl font-bold">{s.v}</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">{s.l}</p>
              <p className="text-[10px] text-zinc-300">{s.u}</p>
            </div>
          ))}
        </div>

        {/* Campaign info */}
        {campaign && (
          <div className="border border-zinc-100 rounded-lg p-5">
            <p className="text-sm font-medium mb-3">Active Campaign</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-[13px]">
              <div>
                <p className="text-zinc-400 text-[11px] mb-0.5">App ID</p>
                <p className="font-mono">{campaign.appId}</p>
              </div>
              <div>
                <p className="text-zinc-400 text-[11px] mb-0.5">Name</p>
                <p>{campaign.name ?? "Campaign"}</p>
              </div>
              <div>
                <p className="text-zinc-400 text-[11px] mb-0.5">Status</p>
                <p className="text-emerald-600 font-medium">{campaign.status ?? "active"}</p>
              </div>
              <div>
                <p className="text-zinc-400 text-[11px] mb-0.5">Budget</p>
                <p className="font-medium">{campaign.budget}</p>
              </div>
            </div>
          </div>
        )}

        {/* How it works */}
        <div className="mt-6 border border-zinc-100 rounded-lg p-5">
          <p className="text-sm font-medium mb-3">How GhostGas Works</p>
          <ol className="space-y-2 text-[13px] text-zinc-500">
            {[
              "User connects wallet with 0 ALGO",
              "Tries to transact, gets prompted to watch a 5s ad",
              "Agent records attestation + settles impression on-chain (7 atomic inner txns)",
              "Sponsor wraps user's transaction with fee pooling (user fee = 0)",
              "User signs in Pera, transaction confirms on Algorand TestNet",
              "Publisher earns 80%, protocol earns 20%, user pays nothing",
            ].map((t, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-[11px] font-mono text-zinc-300 mt-0.5 shrink-0">{(i + 1).toString().padStart(2, "0")}</span>
                <span>{t}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
