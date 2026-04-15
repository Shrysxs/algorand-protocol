"use client";

import { useState } from "react";
import algosdk from "algosdk";
import { useWallet } from "./components/WalletProvider";
import { AdModal } from "./components/AdModal";

const AD_DURATION = 5;
const MIN_FEE = 1000;
// Deployer/admin address — used as publisher in demo (has min balance)
const PUBLISHER_ADDRESS = "EZZ7VQ7PAA76IR3O5WFGD4ABDDPTN2FRPH5WLFZ6RFTYC5PANG7ISXKHGI";

type Step = "idle" | "needs_gas" | "watching_ad" | "settling" | "sponsoring" | "signing" | "confirming" | "done" | "error";

export default function HomePage() {
  const { address, balance, connect, connecting, pera, algodClient, refreshBalance } = useWallet();
  const [step, setStep] = useState<Step>("idle");
  const [txId, setTxId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [impressionId, setImpressionId] = useState<string | null>(null);

  const isProcessing = ["settling", "sponsoring", "signing", "confirming"].includes(step);

  const handleSend = () => {
    if (!address) return;
    if (balance < MIN_FEE) {
      setStep("needs_gas");
    } else {
      sponsorAndSend();
    }
  };

  const handleAdComplete = async () => {
    if (!address) return;
    setStep("settling");
    setError(null);
    try {
      const proofId = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const res = await fetch("/api/impression-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_address: address,
          proof_id: proofId,
          publisher_address: PUBLISHER_ADDRESS,
          duration_seconds: AD_DURATION,
        }),
      });

      if (res.status === 402) {
        setError("Campaign budget exhausted.");
        setStep("error");
        return;
      }
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail ?? data.error ?? "Settlement failed");
      }
      const data = await res.json();
      setImpressionId(data.impression_id ?? null);
      await sponsorAndSend();
    } catch (err: any) {
      setError(err?.message ?? "Settlement failed");
      setStep("error");
    }
  };

  const sponsorAndSend = async () => {
    if (!address) return;
    setStep("sponsoring");
    setError(null);
    try {
      const params = await algodClient.getTransactionParams().do();
      const userTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: address,
        receiver: address,
        amount: BigInt(0),
        suggestedParams: { ...params, fee: BigInt(0), flatFee: true },
      });
      const txnBytes = Buffer.from(algosdk.encodeUnsignedTransaction(userTxn)).toString("base64");

      const sponsorRes = await fetch("/api/sponsor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userAddress: address, txnBytes, impressionId }),
      });
      if (!sponsorRes.ok) {
        const d = await sponsorRes.json();
        throw new Error(d.error ?? "Sponsor failed");
      }
      const { groupTxns } = await sponsorRes.json();

      setStep("signing");
      if (!pera) throw new Error("Wallet not connected");

      // Decode both txns from the group
      // groupTxns[0] = signed sponsor txn (base64 of signed bytes)
      // groupTxns[1] = unsigned user txn (base64 of msgpack-encoded txn)
      const unsignedUserTxn = algosdk.decodeUnsignedTransaction(
        Buffer.from(groupTxns[1], "base64")
      );

      // Pera needs the full group: sponsor txn with signers=[] (already signed, skip),
      // user txn with no signers (Pera signs it)
      const sponsorTxnDecoded = algosdk.decodeSignedTransaction(
        Buffer.from(groupTxns[0], "base64")
      ).txn;

      const signedUserTxns = await pera.signTransaction([
        [
          { txn: sponsorTxnDecoded, signers: [] }, // already signed, skip
          { txn: unsignedUserTxn },                 // Pera signs this one
        ],
      ]);

      setStep("confirming");
      const signedGroup = [
        new Uint8Array(Buffer.from(groupTxns[0], "base64")),
        signedUserTxns[0],
      ];
      const { txid } = await algodClient.sendRawTransaction(signedGroup).do();
      await algosdk.waitForConfirmation(algodClient, txid, 4);

      setTxId(txid);
      await refreshBalance();
      setStep("done");
    } catch (err: any) {
      setError(err?.message ?? "Transaction failed");
      setStep("error");
    }
  };

  const reset = () => {
    setStep("idle");
    setError(null);
    setTxId(null);
  };

  // ── Not connected ──
  if (!address) {
    return (
      <div className="flex-1 flex flex-col">
        {/* Hero */}
        <section className="flex-1 flex flex-col items-center justify-center px-6 py-16 lg:py-24">
          <div className="text-center max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-50 border border-violet-100 text-violet-600 text-xs font-medium mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
              Live on Algorand TestNet
            </div>
            <h1 className="text-[2.75rem] md:text-6xl font-bold tracking-tight leading-[1.1] text-gray-900">
              Never pay gas fees
              <br />
              <span className="bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
                on Algorand
              </span>
            </h1>
            <p className="mt-5 text-base md:text-lg text-gray-500 leading-relaxed max-w-lg mx-auto">
              GhostGas sponsors your transaction fees in exchange for watching a
              15-second ad. Connect your wallet. Transact for free.
            </p>
            <div className="mt-8 flex items-center justify-center gap-3">
              <button
                onClick={connect}
                disabled={connecting}
                className="px-7 py-3 rounded-full bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition shadow-lg shadow-gray-900/10 disabled:opacity-50 active:scale-[0.97]"
              >
                {connecting ? "Connecting..." : "Connect Pera Wallet"}
              </button>
              <a
                href="/dashboard"
                className="px-7 py-3 rounded-full border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
              >
                View Dashboard
              </a>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="px-6 lg:px-10 pb-20">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-center text-xs font-semibold text-gray-400 uppercase tracking-[0.15em] mb-8">
              How it works
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  n: "01",
                  title: "Connect",
                  desc: "Link your Pera Wallet — even with zero ALGO balance.",
                  icon: (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                  ),
                },
                {
                  n: "02",
                  title: "Watch a 15s ad",
                  desc: "A sponsored ad plays. The agent settles your impression on-chain.",
                  icon: (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  ),
                },
                {
                  n: "03",
                  title: "Transact free",
                  desc: "Your transaction is fee-pooled with a sponsor. You pay zero ALGO.",
                  icon: (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" /></svg>
                  ),
                },
              ].map((s) => (
                <div
                  key={s.n}
                  className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center mb-4">
                    {s.icon}
                  </div>
                  <p className="text-[11px] font-semibold text-gray-300 mb-1">{s.n}</p>
                  <h3 className="font-semibold text-gray-900 mb-1">{s.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Tech strip */}
        <section className="border-t border-gray-200 bg-white px-6 py-6">
          <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-[11px] font-medium text-gray-400 uppercase tracking-widest">
            <span>Algorand</span>
            <span className="text-gray-200">|</span>
            <span>Pera Wallet</span>
            <span className="text-gray-200">|</span>
            <span>ARC-4 Contracts</span>
            <span className="text-gray-200">|</span>
            <span>Fee Pooling</span>
            <span className="text-gray-200">|</span>
            <span>Supabase</span>
          </div>
        </section>
      </div>
    );
  }

  // ── Connected ──
  return (
    <div className="flex-1 px-6 lg:px-10 py-8">
      <div className="max-w-3xl mx-auto space-y-5">
        {/* Balance Card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-7">
          <div className="flex items-start justify-between mb-1">
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.1em]">
              Wallet Balance
            </p>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">
              TestNet
            </span>
          </div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900">
              {(balance / 1_000_000).toFixed(2)}
            </span>
            <span className="text-lg font-medium text-gray-300">ALGO</span>
          </div>
          {balance < MIN_FEE && step === "idle" && (
            <p className="mt-2 text-xs text-amber-600 font-medium flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
              Not enough for fees — watch an ad to transact free
            </p>
          )}
        </div>

        {/* Action Card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-7">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Send Transaction</h2>

          {step === "idle" && (
            <button
              onClick={handleSend}
              className="w-full py-3 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition active:scale-[0.98]"
            >
              Send 0 ALGO (Self-Transfer)
            </button>
          )}

          {step === "needs_gas" && (
            <div className="space-y-3">
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                <p className="text-sm font-medium text-amber-800 mb-0.5">Gas fees required</p>
                <p className="text-xs text-amber-600">Watch a 15-second ad and we will cover your fees.</p>
              </div>
              <button
                onClick={() => setStep("watching_ad")}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-semibold hover:from-violet-700 hover:to-indigo-700 transition active:scale-[0.98] shadow-lg shadow-violet-600/20"
              >
                Watch Ad for Free Gas
              </button>
            </div>
          )}

          {isProcessing && (
            <div className="flex items-center gap-3 bg-violet-50 border border-violet-100 rounded-xl p-4">
              <div className="w-5 h-5 border-2 border-violet-600 border-t-transparent rounded-full animate-spin shrink-0" />
              <p className="text-sm text-violet-700 font-medium">
                {step === "settling" && "Recording impression on-chain..."}
                {step === "sponsoring" && "Building sponsored transaction..."}
                {step === "signing" && "Sign in your Pera Wallet..."}
                {step === "confirming" && "Confirming on Algorand..."}
              </p>
            </div>
          )}

          {step === "done" && txId && (
            <div className="space-y-3">
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  <p className="text-sm font-semibold text-emerald-800">Confirmed</p>
                </div>
                <p className="text-xs text-emerald-600">Transaction fee: 0 ALGO</p>
              </div>
              <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                <span className="text-xs text-gray-500 font-mono truncate max-w-[200px]">{txId}</span>
                <a
                  href={`https://testnet.explorer.perawallet.app/tx/${txId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-violet-600 hover:underline shrink-0 ml-3"
                >
                  View on Explorer
                </a>
              </div>
              <button
                onClick={reset}
                className="w-full py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                Send Another
              </button>
            </div>
          )}

          {step === "error" && error && (
            <div className="space-y-3">
              <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                <p className="text-sm font-medium text-red-800 mb-0.5">Error</p>
                <p className="text-xs text-red-600">{error}</p>
              </div>
              <button
                onClick={reset}
                className="w-full py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                Try Again
              </button>
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center">
            <p className="text-2xl font-bold text-gray-900">{(balance / 1_000_000).toFixed(2)}</p>
            <p className="text-[11px] text-gray-400 font-medium mt-0.5">Balance (ALGO)</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center">
            <p className="text-2xl font-bold text-emerald-600">0</p>
            <p className="text-[11px] text-gray-400 font-medium mt-0.5">Fees Paid</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center">
            <p className="text-2xl font-bold text-violet-600">{txId ? "1" : "0"}</p>
            <p className="text-[11px] text-gray-400 font-medium mt-0.5">Txns Sent</p>
          </div>
        </div>
      </div>

      {/* Ad Modal */}
      {step === "watching_ad" && (
        <AdModal
          onComplete={handleAdComplete}
          onClose={() => setStep("idle")}
        />
      )}
    </div>
  );
}
