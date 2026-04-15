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
  budgetTotal?: number;
  totalImpressions?: number;
  name?: string;
  status?: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, campaignRes] = await Promise.all([
        fetch("/api/stats").catch(() => null),
        fetch("/api/campaign").catch(() => null),
      ]);
      if (statsRes?.ok) setStats(await statsRes.json());
      if (campaignRes?.ok) setCampaign(await campaignRes.json());
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const algo = (micro: number) => (micro / 1_000_000).toFixed(4);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 px-6 lg:px-10 py-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Dashboard</h1>
          <p className="text-sm text-gray-400 mt-1">
            Live protocol stats from Supabase + on-chain data
          </p>
        </div>

        {/* Top Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            {
              label: "Total Impressions",
              value: stats?.totalImpressions ?? 0,
              color: "text-gray-900",
            },
            {
              label: "Sponsored Txns",
              value: stats?.totalSponsoredTxns ?? 0,
              color: "text-violet-600",
            },
            {
              label: "Unique Users",
              value: stats?.totalUsers ?? 0,
              color: "text-gray-900",
            },
            {
              label: "Campaign Budget",
              value: campaign?.budget ?? 0,
              color: "text-indigo-600",
              sub: "impressions left",
            },
          ].map((card) => (
            <div
              key={card.label}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
            >
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.1em] mb-2">
                {card.label}
              </p>
              <p className={`text-3xl font-bold ${card.color}`}>{card.value}</p>
              {card.sub && (
                <p className="text-[11px] text-gray-400 mt-0.5">{card.sub}</p>
              )}
            </div>
          ))}
        </div>

        {/* Revenue Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.1em] mb-1">
              Total Settled
            </p>
            <p className="text-2xl font-bold text-gray-900">
              {algo(stats?.totalSettledMicroAlgo ?? 0)}
            </p>
            <p className="text-xs text-gray-400">ALGO</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.1em] mb-1">
              Publisher Earned
            </p>
            <p className="text-2xl font-bold text-emerald-600">
              {algo(stats?.totalPublisherEarnedMicroAlgo ?? 0)}
            </p>
            <p className="text-xs text-gray-400">ALGO (80% share)</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.1em] mb-1">
              Protocol Fees
            </p>
            <p className="text-2xl font-bold text-violet-600">
              {algo(stats?.totalProtocolFeesMicroAlgo ?? 0)}
            </p>
            <p className="text-xs text-gray-400">ALGO (20% share)</p>
          </div>
        </div>

        {/* Campaign Info */}
        {campaign && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Active Campaign</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <p className="text-[11px] text-gray-400 font-medium">App ID</p>
                <p className="text-sm font-mono text-gray-700">{campaign.appId}</p>
              </div>
              <div>
                <p className="text-[11px] text-gray-400 font-medium">Name</p>
                <p className="text-sm text-gray-700">{campaign.name ?? "GhostGas Campaign"}</p>
              </div>
              <div>
                <p className="text-[11px] text-gray-400 font-medium">Status</p>
                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                  (campaign.status ?? "active") === "active"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-red-50 text-red-700"
                }`}>
                  <span className={`w-1 h-1 rounded-full ${
                    (campaign.status ?? "active") === "active" ? "bg-emerald-500" : "bg-red-500"
                  }`} />
                  {campaign.status ?? "active"}
                </span>
              </div>
              <div>
                <p className="text-[11px] text-gray-400 font-medium">Budget Remaining</p>
                <p className="text-sm font-semibold text-gray-700">{campaign.budget}</p>
              </div>
            </div>
          </div>
        )}

        {/* How it works */}
        <div className="mt-8 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-2xl p-7 text-white">
          <h2 className="text-base font-semibold mb-3">How GhostGas Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            {[
              "User connects wallet with 0 ALGO",
              "Clicks to send a transaction, gets prompted to watch an ad",
              "Agent records attestation + settles impression on-chain",
              "Settlement: verify proof, deduct budget, pay publisher 80%, protocol 20%",
              "Sponsor API wraps the user's txn with fee pooling (sponsor pays fee)",
              "User signs in Pera, transaction confirms — zero fees paid",
            ].map((text, i) => (
              <div key={i} className="flex items-start gap-2.5 bg-white/10 rounded-xl p-3">
                <span className="text-[11px] font-bold bg-white/20 rounded-md w-5 h-5 flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <span className="text-white/90 text-[13px] leading-relaxed">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
