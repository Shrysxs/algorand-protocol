"use client";

import Link from "next/link";
import { useWallet } from "./WalletProvider";

export function Navbar() {
  const { address, connecting, connect, disconnect } = useWallet();

  return (
    <nav className="bg-white/80 backdrop-blur-md border-b border-gray-200/60 px-6 lg:px-10 py-3.5 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center gap-8">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-sm">
            <span className="text-white font-bold text-xs">G</span>
          </div>
          <span className="text-base font-semibold tracking-tight">
            GhostGas
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-6 text-[13px] font-medium text-gray-400">
          <Link href="/" className="text-gray-900 hover:text-gray-900 transition">
            Home
          </Link>
          <Link href="/campaign" className="hover:text-gray-900 transition">
            Campaigns
          </Link>
          <Link href="/dashboard" className="hover:text-gray-900 transition">
            Dashboard
          </Link>
          <a
            href="https://testnet.explorer.perawallet.app"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-900 transition"
          >
            Explorer
          </a>
        </div>
      </div>

      <div>
        {address ? (
          <button
            onClick={disconnect}
            className="flex items-center gap-2 text-[13px] px-4 py-2 rounded-full border border-gray-200 bg-white hover:bg-gray-50 transition font-medium shadow-sm"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            {address.slice(0, 4)}...{address.slice(-4)}
          </button>
        ) : (
          <button
            onClick={connect}
            disabled={connecting}
            className="text-[13px] px-5 py-2 rounded-full bg-gray-900 text-white font-medium hover:bg-gray-800 transition disabled:opacity-50 shadow-sm"
          >
            {connecting ? "Connecting..." : "Connect Wallet"}
          </button>
        )}
      </div>
    </nav>
  );
}
