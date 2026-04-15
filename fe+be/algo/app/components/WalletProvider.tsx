"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import algosdk from "algosdk";

const ALGOD_SERVER =
  process.env.NEXT_PUBLIC_ALGOD_SERVER ?? "https://testnet-api.algonode.cloud";

function getClient() {
  return new algosdk.Algodv2("", ALGOD_SERVER, "");
}

interface WalletState {
  address: string | null;
  balance: number;
  connecting: boolean;
  pera: any;
  connect: () => Promise<void>;
  disconnect: () => void;
  refreshBalance: () => Promise<void>;
  algodClient: algosdk.Algodv2;
}

const WalletContext = createContext<WalletState | null>(null);

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const [connecting, setConnecting] = useState(false);
  const peraRef = useRef<any>(null);
  const clientRef = useRef(getClient());

  const refreshBalance = useCallback(async () => {
    if (!address) return;
    try {
      const info = await clientRef.current.accountInformation(address).do();
      setBalance(Number(info.amount ?? 0));
    } catch {
      setBalance(0);
    }
  }, [address]);

  useEffect(() => {
    if (address) refreshBalance();
  }, [address, refreshBalance]);

  const connect = async () => {
    setConnecting(true);
    try {
      const { PeraWalletConnect } = await import("@perawallet/connect");

      // Kill any stale instance
      if (peraRef.current) {
        try { await peraRef.current.disconnect(); } catch {}
        peraRef.current = null;
      }

      const pera = new PeraWalletConnect();
      peraRef.current = pera;

      // Try reconnect first (existing session)
      try {
        const reconnected = await pera.reconnectSession();
        if (reconnected.length > 0) {
          setAddress(reconnected[0]);
          pera.connector?.on("disconnect", () => {
            setAddress(null);
            setBalance(0);
          });
          return;
        }
      } catch {
        // No existing session — proceed to fresh connect
      }

      const accounts = await pera.connect();
      setAddress(accounts[0]);
      pera.connector?.on("disconnect", () => {
        setAddress(null);
        setBalance(0);
      });
    } catch (err: any) {
      if (err?.data?.type !== "CONNECT_MODAL_CLOSED") {
        console.error("Wallet connect error:", err);
      }
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = () => {
    peraRef.current?.disconnect();
    peraRef.current = null;
    setAddress(null);
    setBalance(0);
  };

  return (
    <WalletContext.Provider
      value={{
        address,
        balance,
        connecting,
        pera: peraRef.current,
        connect,
        disconnect,
        refreshBalance,
        algodClient: clientRef.current,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}
