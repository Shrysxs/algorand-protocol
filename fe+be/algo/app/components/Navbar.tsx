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
    <nav className="px-4 lg:px-6 py-3 flex items-center justify-between">
      {/* Logo */}
      <Link href="/" className="text-sm font-semibold tracking-tight text-white pl-2">
        ghostgas
      </Link>

      {/* Center nav — pill shaped */}
      <div className="hidden sm:flex items-center bg-[#141414] border border-white/[0.06] rounded-full px-1 py-1">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`text-[13px] px-4 py-1.5 rounded-full transition-all ${
              pathname === l.href
                ? "text-white bg-white/[0.08]"
                : "text-white/35 hover:text-white/60"
            }`}
          >
            {l.label}
          </Link>
        ))}
      </div>

      {/* Right — pill buttons */}
      <div className="flex items-center gap-2">
        {address ? (
          <button
            onClick={disconnect}
            className="text-[13px] font-mono px-4 py-1.5 rounded-full bg-[#141414] border border-white/[0.06] text-white/50 hover:text-white/80 transition"
          >
            {address.slice(0, 6)}...{address.slice(-4)}
          </button>
        ) : (
          <button
            onClick={connect}
            disabled={connecting}
            className="text-[13px] px-5 py-1.5 rounded-full bg-white text-black font-medium hover:bg-white/90 transition disabled:opacity-50"
          >
            {connecting ? "Connecting..." : "Launch App"}
          </button>
        )}
      </div>
    </nav>
  );
}
