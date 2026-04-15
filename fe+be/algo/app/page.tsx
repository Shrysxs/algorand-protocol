"use client";

import { useState } from "react";
import algosdk from "algosdk";
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

  const isProcessing = ["settling", "sponsoring", "signing", "confirming"].includes(step);
  const statusText: Record<string, string> = {
    settling: "Recording impression on-chain...",
    sponsoring: "Building sponsored transaction...",
    signing: "Sign in Pera Wallet...",
    confirming: "Confirming on Algorand...",
  };

  const handleSend = () => {
    if (!address) return;
    setStep(balance < MIN_FEE ? "needs_gas" : "idle");
    if (balance >= MIN_FEE) sponsorAndSend();
  };

  const handleAdComplete = async () => {
    if (!address) return;
    setStep("settling");
    setError(null);
    try {
      const proofId = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map((b) => b.toString(16).padStart(2, "0")).join("");

      const res = await fetch("/api/impression-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_address: address, proof_id: proofId,
          publisher_address: PUBLISHER_ADDRESS, duration_seconds: AD_DURATION,
        }),
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
    setStep("sponsoring");
    setError(null);
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

      const signedUserTxns = await pera.signTransaction([
        [{ txn: sponsorTxnDecoded, signers: [] }, { txn: unsignedUserTxn }],
      ]);

      setStep("confirming");
      const signedGroup = [new Uint8Array(Buffer.from(groupTxns[0], "base64")), signedUserTxns[0]];
      const { txid } = await algodClient.sendRawTransaction(signedGroup).do();
      await algosdk.waitForConfirmation(algodClient, txid, 4);

      setTxId(txid);
      await refreshBalance();
      setStep("done");
    } catch (err: any) { setError(err?.message ?? "Transaction failed"); setStep("error"); }
  };

  const reset = () => { setStep("idle"); setError(null); setTxId(null); };

  // ── Landing ──
  if (!address) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-20">
        <div className="max-w-lg text-center">
          <p className="text-[11px] text-zinc-400 font-medium uppercase tracking-widest mb-4">Algorand TestNet</p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight mb-4">
            Zero-fee transactions,<br />powered by ads.
          </h1>
          <p className="text-zinc-400 text-[15px] leading-relaxed mb-8 max-w-sm mx-auto">
            Users watch a short ad. GhostGas settles on-chain and sponsors their transaction fees. Users pay nothing.
          </p>
          <button
            onClick={connect}
            disabled={connecting}
            className="px-6 py-2.5 rounded-md bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800 transition disabled:opacity-50"
          >
            {connecting ? "Connecting..." : "Connect Wallet"}
          </button>
        </div>

        <div className="mt-16 max-w-2xl w-full grid grid-cols-3 gap-px bg-zinc-100 rounded-lg overflow-hidden border border-zinc-100">
          {[
            { n: "01", t: "Connect", d: "Link your Pera Wallet" },
            { n: "02", t: "Watch Ad", d: "5 seconds, that's it" },
            { n: "03", t: "Transact", d: "Zero fees, confirmed on-chain" },
          ].map((s) => (
            <div key={s.n} className="bg-white p-5">
              <p className="text-[10px] font-mono text-zinc-300 mb-2">{s.n}</p>
              <p className="text-sm font-medium text-zinc-900 mb-0.5">{s.t}</p>
              <p className="text-[13px] text-zinc-400">{s.d}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Connected ──
  return (
    <div className="flex-1 px-5 lg:px-8 py-8">
      <div className="max-w-lg mx-auto space-y-4">

        {/* Balance */}
        <div className="border border-zinc-100 rounded-lg p-5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-zinc-400 font-medium uppercase tracking-wider">Balance</span>
            <span className="text-[10px] font-mono text-zinc-300 border border-zinc-100 rounded px-1.5 py-0.5">testnet</span>
          </div>
          <p className="text-3xl font-bold tracking-tight">{(balance / 1_000_000).toFixed(2)} <span className="text-lg font-normal text-zinc-300">ALGO</span></p>
          {balance < MIN_FEE && step === "idle" && (
            <p className="text-[13px] text-amber-500 mt-2">Insufficient for fees</p>
          )}
        </div>

        {/* Action */}
        <div className="border border-zinc-100 rounded-lg p-5">
          <p className="text-sm font-medium mb-3">Send Transaction</p>

          {step === "idle" && (
            <button onClick={handleSend} className="w-full py-2.5 rounded-md bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800 transition">
              Send 0 ALGO
            </button>
          )}

          {step === "needs_gas" && (
            <>
              <div className="bg-amber-50 border border-amber-100 rounded-md p-3 mb-3">
                <p className="text-[13px] text-amber-700">You need ALGO for fees. Watch a 5s ad to get sponsored.</p>
              </div>
              <button
                onClick={() => setStep("watching_ad")}
                className="w-full py-2.5 rounded-md bg-zinc-900 text-white text-sm font-medium hover:bg-zinc-800 transition"
              >
                Watch Ad
              </button>
            </>
          )}

          {isProcessing && (
            <div className="flex items-center gap-3 bg-zinc-50 border border-zinc-100 rounded-md p-3">
              <div className="w-4 h-4 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin shrink-0" />
              <p className="text-[13px] text-zinc-600">{statusText[step]}</p>
            </div>
          )}

          {step === "done" && txId && (
            <div className="space-y-3">
              <div className="bg-emerald-50 border border-emerald-100 rounded-md p-3">
                <p className="text-[13px] text-emerald-700 font-medium">Confirmed. Fee: 0 ALGO</p>
              </div>
              <div className="flex items-center justify-between bg-zinc-50 rounded-md px-3 py-2.5">
                <span className="text-[11px] font-mono text-zinc-400 truncate max-w-[180px]">{txId}</span>
                <a href={`https://testnet.explorer.perawallet.app/tx/${txId}`} target="_blank" rel="noopener noreferrer"
                  className="text-[11px] font-medium text-zinc-900 hover:underline ml-2">
                  Explorer
                </a>
              </div>
              <button onClick={reset} className="w-full py-2.5 rounded-md border border-zinc-200 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition">
                Send Another
              </button>
            </div>
          )}

          {step === "error" && error && (
            <div className="space-y-3">
              <div className="bg-red-50 border border-red-100 rounded-md p-3">
                <p className="text-[13px] text-red-600">{error}</p>
              </div>
              <button onClick={reset} className="w-full py-2.5 rounded-md border border-zinc-200 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition">
                Try Again
              </button>
            </div>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-px bg-zinc-100 rounded-lg overflow-hidden border border-zinc-100">
          {[
            { label: "Balance", value: (balance / 1_000_000).toFixed(2), unit: "ALGO" },
            { label: "Fees Paid", value: "0", unit: "ALGO" },
            { label: "Txns", value: txId ? "1" : "0", unit: "sent" },
          ].map((s) => (
            <div key={s.label} className="bg-white p-4 text-center">
              <p className="text-lg font-bold">{s.value}</p>
              <p className="text-[11px] text-zinc-400">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {step === "watching_ad" && <AdModal onComplete={handleAdComplete} onClose={() => setStep("idle")} />}
    </div>
  );
}
