"use client";

import { useCallback, useEffect, useState } from "react";

interface Stats { totalImpressions: number; totalSponsoredTxns: number; totalUsers: number; totalSettledMicroAlgo: number; totalPublisherEarnedMicroAlgo: number; totalProtocolFeesMicroAlgo: number; }
interface Campaign { appId: number; budget: number; name?: string; status?: string; }

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
      if (s) setStats(s); if (c) setCampaign(c);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); const i = setInterval(fetchData, 10000); return () => clearInterval(i); }, [fetchData]);

  const algo = (n: number) => (n / 1_000_000).toFixed(4);

  if (loading) return <div className="flex-1 flex items-center justify-center"><div className="w-4 h-4 border-[1.5px] border-white/60 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="flex-1 px-6 lg:px-10 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-light tracking-tight text-white/90">Dashboard</h1>
          <p className="text-[13px] text-white/30 mt-1">Live protocol stats</p>
        </div>

        {/* Top stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-white/5 rounded-xl overflow-hidden mb-4">
          {[
            { l: "Impressions", v: stats?.totalImpressions ?? 0 },
            { l: "Sponsored Txns", v: stats?.totalSponsoredTxns ?? 0 },
            { l: "Users", v: stats?.totalUsers ?? 0 },
            { l: "Budget Left", v: campaign?.budget ?? 0 },
          ].map((s) => (
            <div key={s.l} className="bg-[#111] p-5">
              <p className="text-2xl font-light text-white/80">{s.v}</p>
              <p className="text-[10px] text-white/20 uppercase tracking-widest mt-1">{s.l}</p>
            </div>
          ))}
        </div>

        {/* Revenue */}
        <div className="grid grid-cols-3 gap-px bg-white/5 rounded-xl overflow-hidden mb-4">
          {[
            { l: "Total Settled", v: algo(stats?.totalSettledMicroAlgo ?? 0), u: "ALGO" },
            { l: "Publisher Earned", v: algo(stats?.totalPublisherEarnedMicroAlgo ?? 0), u: "80% share" },
            { l: "Protocol Fees", v: algo(stats?.totalProtocolFeesMicroAlgo ?? 0), u: "20% share" },
          ].map((s) => (
            <div key={s.l} className="bg-[#111] p-5">
              <p className="text-xl font-light text-white/80">{s.v}</p>
              <p className="text-[10px] text-white/20 uppercase tracking-widest mt-1">{s.l}</p>
              <p className="text-[10px] text-white/10 mt-0.5">{s.u}</p>
            </div>
          ))}
        </div>

        {/* Campaign info */}
        {campaign && (
          <div className="bg-[#111] border border-white/5 rounded-xl p-6 mb-4">
            <p className="text-[10px] text-white/25 font-medium tracking-widest uppercase mb-4">Active Campaign</p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-[13px]">
              {[
                { l: "App ID", v: campaign.appId },
                { l: "Name", v: campaign.name ?? "Campaign" },
                { l: "Status", v: campaign.status ?? "active" },
                { l: "Budget", v: campaign.budget },
              ].map((s) => (
                <div key={s.l}>
                  <p className="text-[11px] text-white/20 mb-0.5">{s.l}</p>
                  <p className={`text-white/70 ${s.l === "App ID" ? "font-mono" : ""} ${s.l === "Status" ? "text-emerald-400" : ""}`}>{s.v}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Flow */}
        <div className="bg-[#111] border border-white/5 rounded-xl p-6">
          <p className="text-[10px] text-white/25 font-medium tracking-widest uppercase mb-4">How GhostGas Works</p>
          <div className="space-y-2">
            {[
              "User connects wallet with 0 ALGO",
              "Tries to transact, watches a 5s ad",
              "Agent settles impression on-chain (7 atomic inner txns)",
              "Sponsor wraps transaction with fee pooling (user fee = 0)",
              "User signs in Pera, transaction confirms",
              "Publisher earns 80%, protocol earns 20%, user pays nothing",
            ].map((t, i) => (
              <div key={i} className="flex gap-3 text-[13px]">
                <span className="font-mono text-white/15 text-[11px] mt-0.5 shrink-0">{(i + 1).toString().padStart(2, "0")}</span>
                <span className="text-white/40">{t}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
