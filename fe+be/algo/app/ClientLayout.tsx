"use client";

import { type ReactNode } from "react";
import { WalletProvider } from "./components/WalletProvider";
import { Navbar } from "./components/Navbar";

export function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <WalletProvider>
      <Navbar />
      <div className="flex-1">{children}</div>
      <footer className="border-t border-zinc-100 px-5 lg:px-8 py-3 flex items-center justify-between text-[11px] text-zinc-400">
        <span>ghostgas</span>
        <span>Algorand TestNet</span>
      </footer>
    </WalletProvider>
  );
}
