"use client";

import { useCallback, useEffect, useState } from "react";

interface CampaignData { appId: number; budget: number; name?: string; status?: string; totalImpressions?: number; costPerImpressionUsdc?: number; adCreativeUrl?: string; }

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
    try { const r = await fetch("/api/campaign"); if (r.ok) setCampaign(await r.json()); } catch {} finally { setLoading(false); }
  }, []);
  useEffect(() => { fetchCampaign(); }, [fetchCampaign]);

  const handleDeposit = async () => {
    const num = parseInt(amount, 10);
    if (!num || num <= 0) { setResult({ type: "error", msg: "Enter a valid number" }); return; }
    setDepositing(true); setResult(null);
    try {
      const r = await fetch("/api/campaign", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: num, name, adCreativeUrl: uploadedUrl }) });
      const d = await r.json();
      if (r.ok) { setResult({ type: "success", msg: `Deposited ${num} impressions. Tx: ${d.txId}` }); setCreating(false); await fetchCampaign(); }
      else setResult({ type: "error", msg: d.error ?? "Failed" });
    } catch (e: any) { setResult({ type: "error", msg: e?.message ?? "Error" }); } finally { setDepositing(false); }
  };

  if (loading) return <div className="flex-1 flex items-center justify-center"><div className="w-4 h-4 border-[1.5px] border-white/60 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="flex-1 px-6 lg:px-10 py-10">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-light tracking-tight text-white/90">Campaigns</h1>
            <p className="text-[13px] text-white/30 mt-1">Create and fund ad campaigns</p>
          </div>
          {!creating && (
            <button onClick={() => setCreating(true)} className="text-[13px] px-4 py-1.5 rounded-full border border-white/15 text-white/80 hover:bg-white/5 transition">
              New Campaign
            </button>
          )}
        </div>

        {creating && (
          <div className="bg-[#111] border border-white/5 rounded-xl p-6 mb-4 space-y-4">
            <p className="text-[10px] text-white/25 font-medium tracking-widest uppercase">{campaign ? "Add Budget" : "Create Campaign"}</p>

            <div>
              <label className="text-[11px] text-white/30 block mb-1">Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/20" />
            </div>

            <div>
              <label className="text-[11px] text-white/30 block mb-1">Budget (impressions)</label>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} min={1}
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-white/20" />
            </div>

            <div>
              <label className="text-[11px] text-white/30 block mb-1">Ad Creative</label>
              {uploadedUrl ? (
                <div className="border border-white/10 rounded-lg overflow-hidden">
                  {uploadedUrl.match(/\.(mp4|webm|mov)/) ? (
                    <video src={uploadedUrl} controls className="w-full max-h-36 object-cover bg-black" />
                  ) : (
                    <img src={uploadedUrl} alt="Ad" className="w-full max-h-36 object-cover" />
                  )}
                  <div className="px-3 py-2 border-t border-white/5 flex items-center justify-between">
                    <span className="text-[11px] text-white/30 truncate max-w-[200px]">{uploadedUrl.split("/").pop()}</span>
                    <button onClick={() => setUploadedUrl(null)} className="text-[11px] text-red-400 hover:underline">Remove</button>
                  </div>
                </div>
              ) : (
                <label className="block cursor-pointer">
                  <div className={`border border-dashed border-white/10 rounded-lg p-5 text-center hover:border-white/20 transition ${uploading ? "opacity-50" : ""}`}>
                    {uploading ? <span className="text-[13px] text-white/40">Uploading...</span> : (
                      <><p className="text-[13px] text-white/40">Click to upload</p><p className="text-[11px] text-white/20 mt-0.5">MP4, WebM, PNG, JPEG</p></>
                    )}
                  </div>
                  <input type="file" accept="video/mp4,video/webm,image/png,image/jpeg,image/gif" className="hidden" disabled={uploading}
                    onChange={async (e) => {
                      const f = e.target.files?.[0]; if (!f) return; setUploading(true); setResult(null);
                      try { const fd = new FormData(); fd.append("file", f); const r = await fetch("/api/upload", { method: "POST", body: fd }); const d = await r.json(); if (r.ok) setUploadedUrl(d.url); else setResult({ type: "error", msg: d.error }); }
                      catch (err: any) { setResult({ type: "error", msg: err?.message }); } finally { setUploading(false); }
                    }} />
                </label>
              )}
            </div>

            <p className="text-[12px] text-white/20">Revenue split: 80% publisher, 20% protocol</p>

            <div className="flex gap-2">
              <button onClick={handleDeposit} disabled={depositing}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium border border-white/15 text-white hover:bg-white/5 transition disabled:opacity-50">
                {depositing ? "Depositing..." : `Deposit ${amount} Impressions`}
              </button>
              <button onClick={() => { setCreating(false); setResult(null); }}
                className="px-4 py-2.5 rounded-lg text-sm text-white/40 border border-white/5 hover:bg-white/5 transition">Cancel</button>
            </div>
          </div>
        )}

        {result && (
          <div className={`rounded-lg p-3 mb-4 text-[13px] border ${result.type === "success" ? "border-emerald-500/20 text-emerald-400 bg-emerald-500/5" : "border-red-500/20 text-red-400 bg-red-500/5"}`}>
            {result.msg}
          </div>
        )}

        {campaign && campaign.appId > 0 && (
          <div className="bg-[#111] border border-white/5 rounded-xl overflow-hidden">
            <div className="p-5 flex items-start justify-between">
              <div>
                <p className="text-sm text-white/80 font-medium">{campaign.name ?? "Campaign"}</p>
                <p className="text-[11px] font-mono text-white/20 mt-0.5">App {campaign.appId}</p>
              </div>
              <span className={`text-[11px] px-2 py-0.5 rounded-full ${(campaign.status ?? "active") === "active" ? "bg-emerald-500/10 text-emerald-400" : "bg-white/5 text-white/30"}`}>
                {campaign.status ?? "active"}
              </span>
            </div>

            <div className="grid grid-cols-4 divide-x divide-white/5 border-t border-white/5">
              {[
                { l: "Budget", v: campaign.budget },
                { l: "Served", v: campaign.totalImpressions ?? 0 },
                { l: "Cost", v: campaign.costPerImpressionUsdc ?? 0.01 },
                { l: "User Fee", v: "0" },
              ].map((s) => (
                <div key={s.l} className="p-4 text-center">
                  <p className="text-base font-medium text-white/80">{s.v}</p>
                  <p className="text-[10px] text-white/20 uppercase tracking-wider mt-0.5">{s.l}</p>
                </div>
              ))}
            </div>

            <div className="p-3 border-t border-white/5 flex gap-2">
              <button onClick={() => setCreating(true)} className="text-[12px] px-3 py-1.5 rounded-lg border border-white/10 text-white/70 hover:bg-white/5 transition">Add Budget</button>
              <a href={`https://testnet.explorer.perawallet.app/application/${campaign.appId}`} target="_blank" rel="noopener noreferrer"
                className="text-[12px] px-3 py-1.5 rounded-lg border border-white/5 text-white/30 hover:text-white/60 transition">Explorer</a>
            </div>
          </div>
        )}

        {(!campaign || campaign.appId === 0) && !creating && (
          <div className="bg-[#111] border border-white/5 rounded-xl p-10 text-center">
            <p className="text-sm text-white/60 mb-1">No campaign yet</p>
            <p className="text-[13px] text-white/25 mb-5">Create one to start sponsoring transactions.</p>
            <button onClick={() => setCreating(true)} className="text-[13px] px-5 py-2 rounded-full border border-white/15 text-white/80 hover:bg-white/5 transition">Create Campaign</button>
          </div>
        )}
      </div>
    </div>
  );
}
