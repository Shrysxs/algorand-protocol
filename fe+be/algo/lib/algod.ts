import algosdk from "algosdk";

export function getAlgodClient(): algosdk.Algodv2 {
  const server =
    process.env.NEXT_PUBLIC_ALGOD_SERVER ??
    "https://testnet-api.algonode.cloud";
  return new algosdk.Algodv2("", server, "");
}

export function getIndexerClient(): algosdk.Indexer {
  const server =
    process.env.NEXT_PUBLIC_INDEXER_SERVER ??
    "https://testnet-idx.algonode.cloud";
  return new algosdk.Indexer("", server, "");
}

export function sponsorAccountFromMnemonic(): algosdk.Account {
  const mnemonic = process.env.SPONSOR_MNEMONIC;
  if (!mnemonic) throw new Error("SPONSOR_MNEMONIC not set");
  return algosdk.mnemonicToSecretKey(mnemonic);
}

/**
 * Load admin account from PRIVATE_KEY env var.
 * Supports both 25-word mnemonic and base64-encoded 64-byte secret key.
 */
export function adminAccountFromKey(): algosdk.Account {
  const key = process.env.PRIVATE_KEY;
  if (!key) throw new Error("PRIVATE_KEY not set");

  // If it looks like a mnemonic (contains spaces), use mnemonicToSecretKey
  if (key.includes(" ")) {
    return algosdk.mnemonicToSecretKey(key);
  }

  // Otherwise treat as base64 secret key
  const raw = Buffer.from(key.replace(/^=/, ""), "base64");
  if (raw.length !== 64) {
    throw new Error(`PRIVATE_KEY: expected 64 bytes, got ${raw.length}`);
  }
  const addr = algosdk.encodeAddress(raw.slice(32));
  return { sk: new Uint8Array(raw), addr: algosdk.Address.fromString(addr) } as algosdk.Account;
}
