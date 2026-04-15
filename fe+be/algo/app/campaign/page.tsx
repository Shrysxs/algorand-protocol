"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface CampaignData {
  appId: number;
  budget: number;
  budgetTotal?: number;
  name?: string;
  status?: string;
  totalImpressions?: number;
  costPerImpressionUsdc?: number;
  advertiser?: string;
  adCreativeUrl?: string;
}

export default function CampaignPage() {
  const [campaign, setCampaign] = useState<CampaignData | null>(null);
  const [loading, setLoading] = useState(true);
  const [depositing, setDepositing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [amount, setAmount] = useState("50");
  const [name, setName] = useState("GhostGas Demo Campaign");
  const [adUrl, setAdUrl] = useState("");
  const [result, setResult] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);

  const fetchCampaign = useCallback(async () => {
    try {
      const res = await fetch("/api/campaign");
      if (res.ok) {
        const data = await res.json();
        setCampaign(data);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCampaign();
  }, [fetchCampaign]);

  const handleDeposit = async () => {
    const num = parseInt(amount, 10);
    if (!num || num <= 0) {
      setResult({ type: "error", message: "Enter a valid number of impressions" });
      return;
    }

    setDepositing(true);
    setResult(null);
    try {
      const res = await fetch("/api/campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: num,
          name: name || undefined,
          adCreativeUrl: adUrl || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ type: "success", message: `Deposited ${num} impressions. Tx: ${data.txId}` });
        setCreating(false);
        await fetchCampaign();
      } else {
        setResult({ type: "error", message: data.error ?? "Failed to deposit" });
      }
    } catch (err: any) {
      setResult({ type: "error", message: err?.message ?? "Network error" });
    } finally {
      setDepositing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 px-6 lg:px-10 py-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Campaigns</h1>
            <p className="text-sm text-gray-400 mt-1">
              Create and manage ad campaigns for GhostGas sponsorship
            </p>
          </div>
          {!creating && (
            <button
              onClick={() => setCreating(true)}
              className="px-5 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition active:scale-[0.97]"
            >
              + New Campaign
            </button>
          )}
        </div>

        {/* Create / Deposit Form */}
        {creating && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-7 mb-6">
            <h2 className="text-base font-semibold text-gray-900 mb-5">
              {campaign ? "Add Budget to Campaign" : "Create Campaign"}
            </h2>

            <div className="space-y-4">
              {/* Campaign Name */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-[0.1em] mb-1.5">
                  Campaign Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My DeFi Campaign"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition"
                />
              </div>

              {/* Budget */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-[0.1em] mb-1.5">
                  Budget (Impressions)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    min={1}
                    placeholder="50"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 transition pr-24"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                    impressions
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                  Each impression = 1 user watches a 15s ad. Budget is deposited on-chain.
                </p>
              </div>

              {/* Ad Creative Upload */}
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-[0.1em] mb-1.5">
                  Ad Creative (Video / Image)
                </label>

                {uploadedUrl ? (
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    {uploadedUrl.match(/\.(mp4|webm|mov)/) ? (
                      <video src={uploadedUrl} controls className="w-full max-h-48 object-cover bg-black" />
                    ) : (
                      <img src={uploadedUrl} alt="Ad creative" className="w-full max-h-48 object-cover" />
                    )}
                    <div className="px-3 py-2 bg-gray-50 flex items-center justify-between">
                      <span className="text-[11px] text-gray-500 truncate max-w-[250px]">{uploadedUrl.split("/").pop()}</span>
                      <button
                        onClick={() => { setUploadedUrl(null); setAdUrl(""); }}
                        className="text-[11px] text-red-500 font-medium hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="block cursor-pointer">
                    <div className={`border-2 border-dashed rounded-xl p-6 text-center transition ${uploading ? "border-violet-300 bg-violet-50" : "border-gray-200 hover:border-violet-300 hover:bg-violet-50/50"}`}>
                      {uploading ? (
                        <div className="flex flex-col items-center gap-2">
                          <div className="w-5 h-5 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
                          <span className="text-xs text-violet-600 font-medium">Uploading...</span>
                        </div>
                      ) : (
                        <>
                          <svg className="w-8 h-8 text-gray-300 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                          <p className="text-sm text-gray-500 mb-0.5">Drop a video or image here</p>
                          <p className="text-[11px] text-gray-400">MP4, WebM, PNG, JPEG up to 50MB</p>
                        </>
                      )}
                    </div>
                    <input
                      type="file"
                      accept="video/mp4,video/webm,video/quicktime,image/png,image/jpeg,image/gif"
                      className="hidden"
                      disabled={uploading}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploading(true);
                        setResult(null);
                        try {
                          const fd = new FormData();
                          fd.append("file", file);
                          const res = await fetch("/api/upload", { method: "POST", body: fd });
                          const data = await res.json();
                          if (res.ok) {
                            setUploadedUrl(data.url);
                            setAdUrl(data.url);
                          } else {
                            setResult({ type: "error", message: data.error ?? "Upload failed" });
                          }
                        } catch (err: any) {
                          setResult({ type: "error", message: err?.message ?? "Upload failed" });
                        } finally {
                          setUploading(false);
                        }
                      }}
                    />
                  </label>
                )}
              </div>

              {/* Revenue Split Info */}
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.1em] mb-2">
                  Revenue Split
                </p>
                <div className="flex gap-6 text-sm">
                  <div>
                    <span className="font-semibold text-emerald-600">80%</span>
                    <span className="text-gray-500 ml-1">to Publisher</span>
                  </div>
                  <div>
                    <span className="font-semibold text-violet-600">20%</span>
                    <span className="text-gray-500 ml-1">Protocol Fee</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleDeposit}
                  disabled={depositing}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-semibold hover:from-violet-700 hover:to-indigo-700 transition disabled:opacity-50 active:scale-[0.98] shadow-lg shadow-violet-600/20"
                >
                  {depositing ? "Depositing on-chain..." : `Deposit ${amount || "0"} Impressions`}
                </button>
                <button
                  onClick={() => {
                    setCreating(false);
                    setResult(null);
                  }}
                  className="px-5 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Result toast */}
        {result && (
          <div
            className={`rounded-xl p-4 mb-6 border ${
              result.type === "success"
                ? "bg-emerald-50 border-emerald-100"
                : "bg-red-50 border-red-100"
            }`}
          >
            <div className="flex items-start gap-2">
              {result.type === "success" ? (
                <svg className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              ) : (
                <svg className="w-4 h-4 text-red-600 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              )}
              <p className={`text-sm ${result.type === "success" ? "text-emerald-700" : "text-red-700"}`}>
                {result.message}
              </p>
            </div>
          </div>
        )}

        {/* Current Campaign Card */}
        {campaign && campaign.appId > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Campaign Header */}
            <div className="p-7 border-b border-gray-100">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">
                    {campaign.name ?? "GhostGas Campaign"}
                  </h2>
                  <p className="text-xs text-gray-400 font-mono mt-0.5">
                    App ID: {campaign.appId}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                    (campaign.status ?? "active") === "active"
                      ? "bg-emerald-50 text-emerald-700"
                      : campaign.status === "exhausted"
                        ? "bg-red-50 text-red-700"
                        : "bg-gray-100 text-gray-600"
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      (campaign.status ?? "active") === "active"
                        ? "bg-emerald-500"
                        : campaign.status === "exhausted"
                          ? "bg-red-500"
                          : "bg-gray-400"
                    }`}
                  />
                  {campaign.status ?? "active"}
                </span>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-gray-100">
              {[
                { label: "Budget Left", value: campaign.budget, unit: "impressions", color: "text-gray-900" },
                { label: "Total Impressions", value: campaign.totalImpressions ?? 0, unit: "served", color: "text-violet-600" },
                { label: "Cost / Impression", value: campaign.costPerImpressionUsdc ?? 0.01, unit: "USDC", color: "text-gray-900" },
                { label: "User Fee", value: "0", unit: "always", color: "text-emerald-600" },
              ].map((stat) => (
                <div key={stat.label} className="p-5">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-[0.1em] mb-1">
                    {stat.label}
                  </p>
                  <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
                  <p className="text-[11px] text-gray-400">{stat.unit}</p>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="p-5 bg-gray-50 border-t border-gray-100 flex gap-3">
              <button
                onClick={() => setCreating(true)}
                className="px-5 py-2 rounded-xl bg-gray-900 text-white text-xs font-semibold hover:bg-gray-800 transition"
              >
                Add Budget
              </button>
              <a
                href={`https://testnet.explorer.perawallet.app/application/${campaign.appId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-5 py-2 rounded-xl border border-gray-200 text-xs font-medium text-gray-600 hover:bg-white transition flex items-center gap-1"
              >
                View on Explorer
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
              </a>
            </div>
          </div>
        )}

        {/* Empty State */}
        {(!campaign || campaign.appId === 0) && !creating && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-violet-50 text-violet-600 flex items-center justify-center mx-auto mb-4">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">No campaign yet</h3>
            <p className="text-sm text-gray-400 mb-5 max-w-sm mx-auto">
              Create your first campaign to start sponsoring user transactions through ads.
            </p>
            <button
              onClick={() => setCreating(true)}
              className="px-6 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition"
            >
              Create Campaign
            </button>
          </div>
        )}

        {/* How campaigns work */}
        <div className="mt-8 bg-white rounded-2xl border border-gray-100 shadow-sm p-7">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">How Campaigns Work</h3>
          <div className="space-y-3">
            {[
              "Advertiser deposits a budget (number of impressions) on-chain via the CampaignV2 contract",
              "Each time a user watches a 15s ad, the agent calls settle_with_proof which deducts 1 impression",
              "Settlement splits payment: 80% to the dApp (publisher), 20% to GhostGas protocol",
              "The paymaster gets funded and grants the user 1 microALGO sponsorship",
              "When budget hits 0, the agent returns HTTP 402 and no more ads are served",
            ].map((text, i) => (
              <div key={i} className="flex gap-3 items-start">
                <span className="w-5 h-5 rounded-md bg-violet-50 text-violet-600 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <p className="text-sm text-gray-600 leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
