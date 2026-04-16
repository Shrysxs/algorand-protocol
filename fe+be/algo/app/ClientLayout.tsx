"use client";

import { type ReactNode } from "react";
import { WalletProvider } from "./components/WalletProvider";
import { Navbar } from "./components/Navbar";

export function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <WalletProvider>
      <Navbar />
      <div className="flex-1">{children}</div>
    </WalletProvider>
  );
}
