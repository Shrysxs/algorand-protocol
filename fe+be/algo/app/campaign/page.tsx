"use client";

import { useCallback, useEffect, useState } from "react";

interface CampaignData {
  appId: number;
  budget: number;
  name?: string;
  status?: string;
  totalImpressions?: number;
  costPerImpressionUsdc?: number;
  adCreativeUrl?: string;
}

export default function CampaignPage() {
  const [campaign, setCampaign] = useState<CampaignData | null>(null);
  const [loading, setLoading] = useState(true);
  const [depositing, setDepositing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [amount, setAmount] = useState("50");
  const [name, setName] = useState("Demo Campaign");
  const [result, setResult] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const fetchCampaign = useCallback(async () => {
    try {
      const res = await fetch("/api/campaign");
      if (res.ok) setCampaign(await res.json());
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchCampaign(); }, [fetchCampaign]);

  const handleDeposit = async () => {
    const num = parseInt(amount, 10);
    if (!num || num <= 0) { setResult({ type: "error", msg: "Enter a valid number" }); return; }
    setDepositing(true); setResult(null);
    try {
      const res = await fetch("/api/campaign", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: num, name, adCreativeUrl: uploadedUrl }),
      });
      const data = await res.json();
      if (res.ok) { setResult({ type: "success", msg: `Deposited ${num} impressions. Tx: ${data.txId}` }); setCreating(false); await fetchCampaign(); }
      else setResult({ type: "error", msg: data.error ?? "Failed" });
    } catch (err: any) { setResult({ type: "error", msg: err?.message ?? "Network error" }); }
    finally { setDepositing(false); }
  };

  if (loading) return <div className="flex-1 flex items-center justify-center"><div className="w-4 h-4 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="flex-1 px-5 lg:px-8 py-8">
      <div className="max-w-xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Campaigns</h1>
            <p className="text-[13px] text-zinc-400 mt-0.5">Create and fund ad campaigns</p>
          </div>
          {!creating && (
            <button onClick={() => setCreating(true)} className="text-[13px] px-4 py-1.5 rounded-md bg-zinc-900 text-white font-medium hover:bg-zinc-800 transition">
              New Campaign
            </button>
          )}
        </div>

        {/* Create form */}
        {creating && (
          <div className="border border-zinc-100 rounded-lg p-5 mb-4 space-y-4">
            <p className="text-sm font-medium">{campaign ? "Add Budget" : "Create Campaign"}</p>

            <div>
              <label className="text-[11px] text-zinc-400 font-medium uppercase tracking-wider block mb-1">Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="My Campaign"
                className="w-full px-3 py-2 rounded-md border border-zinc-200 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-300" />
            </div>

            <div>
              <label className="text-[11px] text-zinc-400 font-medium uppercase tracking-wider block mb-1">Budget (impressions)</label>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} min={1}
                className="w-full px-3 py-2 rounded-md border border-zinc-200 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-300" />
              <p className="text-[11px] text-zinc-400 mt-1">1 impression = 1 user watches the ad</p>
            </div>

            {/* Upload */}
            <div>
              <label className="text-[11px] text-zinc-400 font-medium uppercase tracking-wider block mb-1">Ad Creative</label>
              {uploadedUrl ? (
                <div className="border border-zinc-200 rounded-md overflow-hidden">
                  {uploadedUrl.match(/\.(mp4|webm|mov)/) ? (
                    <video src={uploadedUrl} controls className="w-full max-h-40 object-cover bg-zinc-50" />
                  ) : (
                    <img src={uploadedUrl} alt="Ad" className="w-full max-h-40 object-cover" />
                  )}
                  <div className="px-3 py-2 bg-zinc-50 flex items-center justify-between border-t border-zinc-100">
                    <span className="text-[11px] text-zinc-400 truncate max-w-[200px]">{uploadedUrl.split("/").pop()}</span>
                    <button onClick={() => setUploadedUrl(null)} className="text-[11px] text-red-500 hover:underline">Remove</button>
                  </div>
                </div>
              ) : (
                <label className="block cursor-pointer">
                  <div className={`border border-dashed rounded-md p-5 text-center transition ${uploading ? "border-zinc-300 bg-zinc-50" : "border-zinc-200 hover:border-zinc-300"}`}>
                    {uploading ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-3 h-3 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin" />
                        <span className="text-[13px] text-zinc-500">Uploading...</span>
                      </div>
                    ) : (
                      <>
                        <p className="text-[13px] text-zinc-500">Click to upload video or image</p>
                        <p className="text-[11px] text-zinc-400 mt-0.5">MP4, WebM, PNG, JPEG</p>
                      </>
                    )}
                  </div>
                  <input type="file" accept="video/mp4,video/webm,image/png,image/jpeg,image/gif" className="hidden" disabled={uploading}
                    onChange={async (e) => {
                      const file = e.target.files?.[0]; if (!file) return;
                      setUploading(true); setResult(null);
                      try {
                        const fd = new FormData(); fd.append("file", file);
                        const res = await fetch("/api/upload", { method: "POST", body: fd });
                        const data = await res.json();
                        if (res.ok) setUploadedUrl(data.url);
                        else setResult({ type: "error", msg: data.error ?? "Upload failed" });
                      } catch (err: any) { setResult({ type: "error", msg: err?.message ?? "Upload failed" }); }
                      finally { setUploading(false); }
                    }}
                  />
                </label>
              )}
            </div>

            <div className="bg-zinc-50 rounded-md p-3 text-[13px] text-zinc-500">
              Revenue split: <span className="font-medium text-zinc-700">80%</span> publisher, <span className="font-medium text-zinc-700">20%</span> protocol
            </div>

            <div className="flex gap-2">
              <button onClick={handleDeposit} disabled={depositing}
                className="flex-1 py-2.5 rounded-md bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800 transition disabled:opacity-50">
                {depositing ? "Depositing..." : `Deposit ${amount || "0"} Impressions`}
              </button>
              <button onClick={() => { setCreating(false); setResult(null); }}
                className="px-4 py-2.5 rounded-md border border-zinc-200 text-sm text-zinc-500 hover:bg-zinc-50 transition">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className={`rounded-md p-3 mb-4 text-[13px] border ${result.type === "success" ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-red-50 border-red-100 text-red-600"}`}>
            {result.msg}
          </div>
        )}

        {/* Campaign card */}
        {campaign && campaign.appId > 0 && (
          <div className="border border-zinc-100 rounded-lg overflow-hidden">
            <div className="p-5 flex items-start justify-between">
              <div>
                <p className="text-sm font-medium">{campaign.name ?? "Campaign"}</p>
                <p className="text-[11px] font-mono text-zinc-400 mt-0.5">App {campaign.appId}</p>
              </div>
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                (campaign.status ?? "active") === "active" ? "bg-emerald-50 text-emerald-600" : "bg-zinc-100 text-zinc-500"
              }`}>
                {campaign.status ?? "active"}
              </span>
            </div>

            <div className="grid grid-cols-4 divide-x divide-zinc-100 border-t border-zinc-100">
              {[
                { l: "Budget", v: campaign.budget },
                { l: "Served", v: campaign.totalImpressions ?? 0 },
                { l: "Cost", v: campaign.costPerImpressionUsdc ?? 0.01 },
                { l: "User Fee", v: "0" },
              ].map((s) => (
                <div key={s.l} className="p-4 text-center">
                  <p className="text-base font-bold">{s.v}</p>
                  <p className="text-[10px] text-zinc-400 mt-0.5">{s.l}</p>
                </div>
              ))}
            </div>

            <div className="p-3 border-t border-zinc-100 bg-zinc-50 flex gap-2">
              <button onClick={() => setCreating(true)} className="text-[12px] px-3 py-1.5 rounded-md bg-zinc-900 text-white font-medium hover:bg-zinc-800 transition">
                Add Budget
              </button>
              <a href={`https://testnet.explorer.perawallet.app/application/${campaign.appId}`} target="_blank" rel="noopener noreferrer"
                className="text-[12px] px-3 py-1.5 rounded-md border border-zinc-200 text-zinc-600 hover:bg-white transition">
                Explorer
              </a>
            </div>
          </div>
        )}

        {/* Empty */}
        {(!campaign || campaign.appId === 0) && !creating && (
          <div className="border border-zinc-100 rounded-lg p-10 text-center">
            <p className="text-sm font-medium mb-1">No campaign yet</p>
            <p className="text-[13px] text-zinc-400 mb-4">Create one to start sponsoring user transactions.</p>
            <button onClick={() => setCreating(true)} className="text-[13px] px-4 py-2 rounded-md bg-zinc-900 text-white font-medium hover:bg-zinc-800 transition">
              Create Campaign
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
