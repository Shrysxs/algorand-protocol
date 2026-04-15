"use client";

import { type ReactNode } from "react";
import { WalletProvider } from "./components/WalletProvider";
import { Navbar } from "./components/Navbar";

export function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <WalletProvider>
      <Navbar />
      {children}
      <footer className="border-t border-gray-200 bg-white px-6 lg:px-10 py-4 flex items-center justify-between mt-auto">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center">
            <span className="text-white text-[9px] font-bold">G</span>
          </div>
          <span className="text-xs text-gray-400 font-medium">GhostGas Protocol</span>
        </div>
        <span className="text-[11px] text-gray-400">Algorand TestNet</span>
      </footer>
    </WalletProvider>
  );
}
