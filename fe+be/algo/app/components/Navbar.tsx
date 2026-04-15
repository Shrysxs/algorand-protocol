"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "./WalletProvider";

export function Navbar() {
  const { address, connecting, connect, disconnect } = useWallet();
  const pathname = usePathname();

  const links = [
    { href: "/", label: "Home" },
    { href: "/campaign", label: "Campaigns" },
    { href: "/dashboard", label: "Dashboard" },
  ];

  return (
    <nav className="border-b border-zinc-100 px-5 lg:px-8 h-14 flex items-center justify-between bg-white sticky top-0 z-40">
      <div className="flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-sm font-bold tracking-tight">ghostgas</span>
        </Link>

        <div className="hidden sm:flex items-center gap-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`text-[13px] px-3 py-1.5 rounded-md transition ${
                pathname === l.href
                  ? "text-zinc-900 bg-zinc-100 font-medium"
                  : "text-zinc-400 hover:text-zinc-600"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>

      {address ? (
        <button
          onClick={disconnect}
          className="text-[13px] font-mono px-3 py-1.5 rounded-md border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition"
        >
          {address.slice(0, 6)}...{address.slice(-4)}
        </button>
      ) : (
        <button
          onClick={connect}
          disabled={connecting}
          className="text-[13px] px-4 py-1.5 rounded-md bg-zinc-900 text-white font-medium hover:bg-zinc-800 transition disabled:opacity-50"
        >
          {connecting ? "Connecting..." : "Connect"}
        </button>
      )}
    </nav>
  );
}
