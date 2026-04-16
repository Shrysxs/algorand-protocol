"use client";

import { useState } from "react";
import algosdk from "algosdk";
import Link from "next/link";
import { useWallet } from "./components/WalletProvider";
import { AdModal } from "./components/AdModal";

const AD_DURATION = 5;
const MIN_FEE = 1000;
const PUBLISHER_ADDRESS = "EZZ7VQ7PAA76IR3O5WFGD4ABDDPTN2FRPH5WLFZ6RFTYC5PANG7ISXKHGI";

type Step = "idle" | "needs_gas" | "watching_ad" | "settling" | "sponsoring" | "signing" | "confirming" | "done" | "error";

export default function HomePage() {
  const { address, balance, connect, connecting, pera, algodClient, refreshBalance } = useWallet();
  const [step, setStep] = useState<Step>("idle");
  const [txId, setTxId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [impressionId, setImpressionId] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const isProcessing = ["settling", "sponsoring", "signing", "confirming"].includes(step);
  const statusText: Record<string, string> = {
    settling: "Recording impression on-chain...",
    sponsoring: "Building sponsored transaction...",
    signing: "Sign in Pera Wallet...",
    confirming: "Confirming on Algorand...",
  };

  const handleSend = () => {
    if (!address) return;
    if (balance < MIN_FEE) setStep("needs_gas");
    else sponsorAndSend();
  };

  const handleAdComplete = async () => {
    if (!address) return;
    setStep("settling"); setError(null);
    try {
      const proofId = Array.from(crypto.getRandomValues(new Uint8Array(16))).map((b) => b.toString(16).padStart(2, "0")).join("");
      const res = await fetch("/api/impression-complete", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_address: address, proof_id: proofId, publisher_address: PUBLISHER_ADDRESS, duration_seconds: AD_DURATION }),
      });
      if (res.status === 402) { setError("Campaign budget exhausted."); setStep("error"); return; }
      if (!res.ok) { const d = await res.json(); throw new Error(d.detail ?? d.error ?? "Agent failed"); }
      const data = await res.json();
      setImpressionId(data.impression_id ?? null);
      await sponsorAndSend();
    } catch (err: any) { setError(err?.message ?? "Settlement failed"); setStep("error"); }
  };

  const sponsorAndSend = async () => {
    if (!address) return;
    setStep("sponsoring"); setError(null);
    try {
      const params = await algodClient.getTransactionParams().do();
      const userTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: address, receiver: address, amount: BigInt(0),
        suggestedParams: { ...params, fee: BigInt(0), flatFee: true },
      });
      const txnBytes = Buffer.from(algosdk.encodeUnsignedTransaction(userTxn)).toString("base64");
      const sponsorRes = await fetch("/api/sponsor", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userAddress: address, txnBytes, impressionId }),
      });
      if (!sponsorRes.ok) { const d = await sponsorRes.json(); throw new Error(d.error ?? "Sponsor failed"); }
      const { groupTxns } = await sponsorRes.json();
      setStep("signing");
      if (!pera) throw new Error("Wallet not connected");
      const unsignedUserTxn = algosdk.decodeUnsignedTransaction(Buffer.from(groupTxns[1], "base64"));
      const sponsorTxnDecoded = algosdk.decodeSignedTransaction(Buffer.from(groupTxns[0], "base64")).txn;
      const signedUserTxns = await pera.signTransaction([[{ txn: sponsorTxnDecoded, signers: [] }, { txn: unsignedUserTxn }]]);
      setStep("confirming");
      const signedGroup = [new Uint8Array(Buffer.from(groupTxns[0], "base64")), signedUserTxns[0]];
      const { txid } = await algodClient.sendRawTransaction(signedGroup).do();
      await algosdk.waitForConfirmation(algodClient, txid, 4);
      setTxId(txid); await refreshBalance(); setStep("done");
    } catch (err: any) { setError(err?.message ?? "Transaction failed"); setStep("error"); }
  };

  const reset = () => { setStep("idle"); setError(null); setTxId(null); };

  // ── Connected view ──
  if (address) {
    return (
      <div className="flex-1 px-6 lg:px-10 py-10">
        <div className="max-w-md mx-auto space-y-4">
          <div className="bg-[#111] border border-white/5 rounded-xl p-6">
            <p className="text-[10px] text-white/25 font-medium tracking-widest uppercase mb-2">Wallet Balance</p>
            <p className="text-4xl font-light tracking-tight text-white/90">
              {(balance / 1_000_000).toFixed(2)} <span className="text-lg text-white/20">ALGO</span>
            </p>
            {balance < MIN_FEE && step === "idle" && (
              <p className="text-[13px] text-amber-400/80 mt-2">Insufficient for fees</p>
            )}
          </div>
          <div className="bg-[#111] border border-white/5 rounded-xl p-6">
            <p className="text-[10px] text-white/25 font-medium tracking-widest uppercase mb-4">Transaction</p>
            {step === "idle" && (
              <button onClick={handleSend} className="w-full py-3 rounded-lg text-sm font-medium border border-white/10 text-white hover:bg-white/5 transition">Send 0 ALGO</button>
            )}
            {step === "needs_gas" && (
              <>
                <p className="text-[13px] text-white/40 mb-3">Watch a 5s ad to get your fees sponsored.</p>
                <button onClick={() => setStep("watching_ad")} className="w-full py-3 rounded-lg text-sm font-medium border border-white/10 text-white hover:bg-white/5 transition">Watch Ad</button>
              </>
            )}
            {isProcessing && (
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 border-[1.5px] border-white/60 border-t-transparent rounded-full animate-spin shrink-0" />
                <p className="text-[13px] text-white/50">{statusText[step]}</p>
              </div>
            )}
            {step === "done" && txId && (
              <div className="space-y-3">
                <p className="text-[13px] text-emerald-400">Confirmed. Fee: 0 ALGO</p>
                <div className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2.5">
                  <span className="text-[11px] font-mono text-white/30 truncate max-w-[180px]">{txId}</span>
                  <a href={`https://testnet.explorer.perawallet.app/tx/${txId}`} target="_blank" rel="noopener noreferrer" className="text-[11px] text-white/60 hover:text-white transition ml-2">Explorer</a>
                </div>
                <button onClick={reset} className="w-full py-2.5 rounded-lg text-sm border border-white/10 text-white/60 hover:text-white hover:bg-white/5 transition">Send Another</button>
              </div>
            )}
            {step === "error" && error && (
              <div className="space-y-3">
                <p className="text-[13px] text-red-400">{error}</p>
                <button onClick={reset} className="w-full py-2.5 rounded-lg text-sm border border-white/10 text-white/60 hover:text-white hover:bg-white/5 transition">Try Again</button>
              </div>
            )}
          </div>
          <div className="grid grid-cols-3 gap-px bg-white/5 rounded-xl overflow-hidden">
            {[{ l: "Balance", v: (balance / 1_000_000).toFixed(2) }, { l: "Fees Paid", v: "0" }, { l: "Txns", v: txId ? "1" : "0" }].map((s) => (
              <div key={s.l} className="bg-[#111] p-4 text-center">
                <p className="text-lg font-medium text-white/80">{s.v}</p>
                <p className="text-[10px] text-white/25 uppercase tracking-wider mt-0.5">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
        {step === "watching_ad" && <AdModal onComplete={handleAdComplete} onClose={() => setStep("idle")} />}
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // LANDING PAGE
  // ════════════════════════════════════════════════════════════════════════

  const faqs = [
    { q: "What is GhostGas?", a: "GhostGas is an ad-sponsored gas abstraction protocol for Algorand. It lets users transact with zero ALGO by watching a short ad that funds their transaction fees." },
    { q: "How does the user pay zero fees?", a: "Algorand supports native fee pooling. A sponsor transaction overpays the fee to cover both itself and the user's transaction. The user's transaction has fee = 0." },
    { q: "Where does the money come from?", a: "Advertisers fund campaigns with impression budgets. Each time a user watches an ad, the advertiser's budget is deducted and the revenue is split: 80% to the publisher (dApp) and 20% to the GhostGas protocol." },
    { q: "Is this on mainnet?", a: "Currently deployed on Algorand TestNet. All transactions, attestations, and settlements are real on-chain operations — just on testnet." },
    { q: "Can I integrate GhostGas into my dApp?", a: "Yes. Install @ghostgas/sdk and add 5 lines of code. Your users get zero-fee transactions, and you earn 80% of ad revenue as the publisher." },
    { q: "What happens when the campaign budget runs out?", a: "The agent returns HTTP 402 (Payment Required) and no more ads are served. The advertiser needs to deposit more budget to resume sponsorship." },
  ];

  return (
    <div className="flex-1 flex flex-col">

      {/* ── Hero ── */}
      <section className="flex flex-col items-center justify-center px-6 pt-24 pb-20 lg:pt-32 lg:pb-28">
        <h1 className="text-4xl sm:text-5xl md:text-[3.5rem] font-light tracking-tight text-center leading-[1.15] text-white/90">
          Zero-Fee Transactions<br />for Algorand
        </h1>
        <p className="mt-5 text-[15px] text-white/35 text-center max-w-md leading-relaxed">
          Users watch a short ad. GhostGas settles on-chain and sponsors their transaction fees. Users pay nothing.
        </p>
        <div className="mt-8 flex items-center gap-3">
          <button
            onClick={connect} disabled={connecting}
            className="text-[13px] px-6 py-2.5 rounded-full bg-white text-black font-medium hover:bg-white/90 transition disabled:opacity-50"
          >
            {connecting ? "Connecting..." : "Launch App"}
          </button>
          <Link href="/dashboard" className="text-[13px] px-6 py-2.5 rounded-full border border-white/[0.08] text-white/50 hover:text-white/80 hover:border-white/15 transition">
            Dashboard
          </Link>
        </div>
      </section>

      {/* ── Stats strip ── */}
      <section className="border-y border-white/5">
        <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-4 divide-x divide-white/5">
          {[
            { label: "NETWORK", value: "Algorand" },
            { label: "FEE MODEL", value: "Ad-Sponsored" },
            { label: "USER COST", value: "0 ALGO" },
            { label: "REVENUE SPLIT", value: "80 / 20" },
          ].map((s) => (
            <div key={s.label} className="px-6 py-5">
              <p className="text-[10px] text-white/20 font-medium tracking-widest uppercase mb-1">{s.label}</p>
              <p className="text-sm text-white/70 font-medium">{s.value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="px-6 py-20 lg:py-24">
        <div className="max-w-4xl mx-auto">
          <p className="text-[10px] text-white/20 font-medium tracking-widest uppercase text-center mb-3">How it works</p>
          <h2 className="text-2xl sm:text-3xl font-light tracking-tight text-center text-white/85 mb-12">
            Three steps to free transactions
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/5 rounded-xl overflow-hidden">
            {[
              { n: "01", title: "Connect", desc: "Link your Pera Wallet to GhostGas. Works even with zero ALGO balance.", icon: "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" },
              { n: "02", title: "Watch Ad", desc: "A 5-second sponsored ad plays. The agent records your impression on-chain as proof.", icon: "M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
              { n: "03", title: "Transact", desc: "Your transaction is fee-pooled with a sponsor. Confirmed on Algorand, zero fees paid.", icon: "M5 13l4 4L19 7" },
            ].map((s) => (
              <div key={s.n} className="bg-[#0e0e0e] p-8">
                <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center mb-5">
                  <svg className="w-5 h-5 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={s.icon} />
                  </svg>
                </div>
                <p className="text-[10px] font-mono text-white/15 mb-2">{s.n}</p>
                <h3 className="text-base font-medium text-white/80 mb-2">{s.title}</h3>
                <p className="text-[13px] text-white/30 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="px-6 py-20 lg:py-24 border-t border-white/5">
        <div className="max-w-4xl mx-auto">
          <p className="text-[10px] text-white/20 font-medium tracking-widest uppercase text-center mb-3">Features</p>
          <h2 className="text-2xl sm:text-3xl font-light tracking-tight text-center text-white/85 mb-12">
            Built for Algorand, not a wrapper
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-white/5 rounded-xl overflow-hidden">
            {[
              { title: "On-Chain Attestation", desc: "Every ad impression is recorded as a cryptographic proof in contract box storage. Advertisers can verify every view." },
              { title: "Atomic Settlement", desc: "7 inner transactions execute atomically: verify proof, deduct budget, split payments, fund sponsorship. All or nothing." },
              { title: "Native Fee Pooling", desc: "Uses Algorand's built-in fee pooling. No relayer infrastructure, no paymaster overhead. Just native protocol features." },
              { title: "x402 Protocol", desc: "When campaign budget hits zero, the agent returns HTTP 402 Payment Required. Clean, standards-based budget enforcement." },
              { title: "SDK Integration", desc: "5 lines of code for any dApp. Install @ghostgas/sdk, configure your campaign, and your users transact for free." },
              { title: "Autonomous Agent", desc: "The settlement agent runs fully autonomously. No human trigger needed. Ad plays, agent settles, user transacts." },
            ].map((f) => (
              <div key={f.title} className="bg-[#0e0e0e] p-7">
                <h3 className="text-sm font-medium text-white/80 mb-2">{f.title}</h3>
                <p className="text-[13px] text-white/30 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SDK ── */}
      <section className="px-6 py-20 lg:py-24 border-t border-white/5">
        <div className="max-w-3xl mx-auto">
          <p className="text-[10px] text-white/20 font-medium tracking-widest uppercase text-center mb-3">For Developers</p>
          <h2 className="text-2xl sm:text-3xl font-light tracking-tight text-center text-white/85 mb-4">
            5 lines to zero-fee transactions
          </h2>
          <p className="text-[15px] text-white/30 text-center mb-10 max-w-md mx-auto">
            Install the SDK, configure your campaign, and your users never pay gas again. You earn 80% of ad revenue.
          </p>

          <div className="bg-[#111] border border-white/5 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
              <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
              <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
              <span className="text-[11px] text-white/20 ml-2 font-mono">app.ts</span>
            </div>
            <pre className="p-5 text-[13px] font-mono leading-relaxed overflow-x-auto">
              <code>
                <span className="text-white/30">{"import { "}</span>
                <span className="text-white/70">GhostGas</span>
                <span className="text-white/30">{" } from "}</span>
                <span className="text-emerald-400/70">{'"@ghostgas/sdk"'}</span>
                <span className="text-white/30">;</span>
                {"\n\n"}
                <span className="text-white/30">{"const "}</span>
                <span className="text-white/70">ghost</span>
                <span className="text-white/30">{" = new "}</span>
                <span className="text-white/70">GhostGas</span>
                <span className="text-white/30">{"({"}</span>
                {"\n"}
                <span className="text-white/30">{"  campaignAppId: "}</span>
                <span className="text-amber-400/70">758809461</span>
                <span className="text-white/30">,</span>
                {"\n"}
                <span className="text-white/30">{"  publisherAddress: "}</span>
                <span className="text-emerald-400/70">{'"YOUR_ADDRESS"'}</span>
                <span className="text-white/30">,</span>
                {"\n"}
                <span className="text-white/30">{"});"}</span>
                {"\n\n"}
                <span className="text-white/20">{"// One call — settle, sponsor, sign, confirm"}</span>
                {"\n"}
                <span className="text-white/30">{"const "}</span>
                <span className="text-white/70">result</span>
                <span className="text-white/30">{" = await "}</span>
                <span className="text-white/70">ghost</span>
                <span className="text-white/30">.</span>
                <span className="text-white/70">sponsoredSend</span>
                <span className="text-white/30">(addr, txn, wallet);</span>
              </code>
            </pre>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="px-6 py-20 lg:py-24 border-t border-white/5">
        <div className="max-w-2xl mx-auto">
          <p className="text-[10px] text-white/20 font-medium tracking-widest uppercase text-center mb-3">FAQ</p>
          <h2 className="text-2xl sm:text-3xl font-light tracking-tight text-center text-white/85 mb-12">
            Frequently asked questions
          </h2>

          <div className="divide-y divide-white/5">
            {faqs.map((faq, i) => (
              <div key={i}>
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between py-5 text-left group"
                >
                  <span className="text-[15px] text-white/70 group-hover:text-white/90 transition pr-4">{faq.q}</span>
                  <svg
                    className={`w-4 h-4 text-white/20 shrink-0 transition-transform ${openFaq === i ? "rotate-45" : ""}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
                {openFaq === i && (
                  <p className="text-[13px] text-white/30 leading-relaxed pb-5 pr-8">{faq.a}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/5 px-6">
        <div className="max-w-5xl mx-auto py-12">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-8 mb-12">
            <div>
              <p className="text-sm font-semibold text-white/80 mb-3">ghostgas</p>
              <p className="text-[13px] text-white/25 leading-relaxed">
                Ad-sponsored gas abstraction for Algorand. Zero-fee transactions, powered by impressions.
              </p>
            </div>
            <div>
              <p className="text-[10px] text-white/20 font-medium tracking-widest uppercase mb-3">Protocol</p>
              <div className="space-y-2">
                <Link href="/campaign" className="block text-[13px] text-white/35 hover:text-white/60 transition">Campaigns</Link>
                <Link href="/dashboard" className="block text-[13px] text-white/35 hover:text-white/60 transition">Dashboard</Link>
                <a href="https://testnet.explorer.perawallet.app/application/758809461" target="_blank" rel="noopener noreferrer" className="block text-[13px] text-white/35 hover:text-white/60 transition">Explorer</a>
              </div>
            </div>
            <div>
              <p className="text-[10px] text-white/20 font-medium tracking-widest uppercase mb-3">Developers</p>
              <div className="space-y-2">
                <a href="https://github.com/Shrysxs/algorand-protocol" target="_blank" rel="noopener noreferrer" className="block text-[13px] text-white/35 hover:text-white/60 transition">GitHub</a>
                <span className="block text-[13px] text-white/35">SDK Docs</span>
                <span className="block text-[13px] text-white/35">Contract Docs</span>
              </div>
            </div>
            <div>
              <p className="text-[10px] text-white/20 font-medium tracking-widest uppercase mb-3">Network</p>
              <div className="space-y-2">
                <span className="block text-[13px] text-white/35">Algorand TestNet</span>
                <span className="block text-[13px] text-white/35">ARC-4 Contracts</span>
                <span className="block text-[13px] text-white/35">Pera Wallet</span>
              </div>
            </div>
          </div>
          <div className="border-t border-white/5 pt-6 flex items-center justify-between">
            <p className="text-[11px] text-white/15">ghostgas protocol</p>
            <p className="text-[11px] text-white/15">Algorand TestNet</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
