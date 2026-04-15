# GhostGas

**Ad-sponsored gas abstraction for Algorand.** Users with 0 ALGO watch a 15-second ad, an autonomous agent settles the impression on-chain, and a sponsor covers their transaction fees — so the user pays nothing.

## How It Works

```mermaid
sequenceDiagram
    participant U as User (0 ALGO)
    participant FE as Frontend
    participant AG as Settlement Agent
    participant AT as Attestation Contract
    participant ST as Settlement Contract
    participant CM as Campaign Contract
    participant PM as Paymaster Contract
    participant SP as Sponsor API

    U->>FE: Connect Pera Wallet
    FE->>U: Show 0 ALGO balance
    U->>FE: Click "Send Transaction"
    FE->>U: "Watch ad for free gas"
    U->>FE: Watches 15s ad

    FE->>AG: POST /impression/complete
    AG->>CM: get_budget() — x402 check
    CM-->>AG: budget > 0

    AG->>AT: record_attestation(proof_id)
    AT-->>AG: proof stored in box

    AG->>ST: settle_with_proof(amount, publisher, proof_id, user)
    ST->>AT: validate_and_consume(proof_id)
    AT-->>ST: proof consumed
    ST->>CM: deduct_for_impression()
    CM-->>ST: budget -= 1
    ST->>ST: Payment 80% → publisher
    ST->>ST: Payment 20% → protocol
    ST->>PM: receive_funds(amount)
    ST->>PM: grant_sponsorship(user)
    PM->>U: 1 microALGO

    AG-->>FE: success + tx IDs

    FE->>SP: POST /api/sponsor (user's unsigned txn)
    SP->>SP: Build fee-pooled group (sponsor fee = 2x, user fee = 0)
    SP->>SP: Sign sponsor txn
    SP-->>FE: [signed sponsor txn, unsigned user txn]

    FE->>U: Sign your transaction in Pera
    U->>FE: Signed
    FE->>FE: Submit group to Algorand
    FE-->>U: Transaction confirmed (0 fees paid)
```

## Architecture

```mermaid
graph TB
    subgraph Frontend["Frontend (Next.js)"]
        PAGE[Demo Page<br/>Pera Wallet + Ad Modal]
        API_S["/api/sponsor<br/>Fee Pooling"]
        API_C["/api/campaign<br/>Budget CRUD"]
        API_I["/api/impression<br/>Proof Status"]
    end

    subgraph Agent["Settlement Agent (FastAPI)"]
        IMP["/impression/complete<br/>Verify + Settle"]
        X402["x402 Middleware<br/>HTTP 402 if budget = 0"]
    end

    subgraph Contracts["Algorand Smart Contracts"]
        ATT["AttestationV2<br/>Box: proof:* → status"]
        CAM["CampaignV2<br/>State: budget, cost_per_impression"]
        SET["SettlementV2<br/>Orchestrator (6 inner txns)"]
        PAY["PaymasterV2<br/>State: balance<br/>Inner: Payment → user"]
    end

    subgraph DB["Supabase (PostgreSQL)"]
        T1["campaigns"]
        T2["impressions"]
        T3["sponsored_txns"]
        T4["users"]
    end

    PAGE -->|"POST"| IMP
    PAGE -->|"POST"| API_S
    PAGE -->|"GET"| API_C
    PAGE -->|"GET"| API_I

    IMP --> ATT
    IMP --> SET
    IMP -->|"log"| T2
    IMP -->|"log"| T4
    SET -->|"inner call"| ATT
    SET -->|"inner call"| CAM
    SET -->|"inner payment"| PAY
    API_C --> CAM
    API_C -->|"read/write"| T1
    API_I --> ATT
    API_S -->|"fee pooling"| PAGE
    API_S -->|"log"| T3

    style SET fill:#4f46e5,color:#fff
    style X402 fill:#dc2626,color:#fff
    style DB fill:#3ecf8e,color:#000
```

## Contract System

Four AlgoPy (ARC4) contracts on Algorand TestNet:

| Contract | Role | Key State |
|---|---|---|
| **AttestationV2** | Proof storage & verification | Box: `proof:{id}` → `1` |
| **CampaignV2** | Advertiser budget tracking | `budget`, `cost_per_impression` |
| **PaymasterV2** | ALGO fee sponsorship | `balance` (tracks microALGO) |
| **SettlementV2** | Orchestrator — ties everything together | Links to other 3 contracts |

### Settlement Flow (settle_with_proof)

The Settlement contract executes 6 inner transactions atomically:

```mermaid
graph LR
    A["1. Validate & consume proof"] --> B["2. Deduct campaign budget"]
    B --> C["3. Pay publisher (80%)"]
    C --> D["4. Pay protocol (20%)"]
    D --> E["5. Fund paymaster"]
    E --> F["6. Grant sponsorship to user"]
```

### Fee Sponsorship (Sponsor API)

Uses Algorand's **fee pooling** — no smart contract needed for fee coverage:

```
Group of 2 transactions:
  Txn 0: Sponsor → Sponsor (0 ALGO, fee = 2000 μALGO)  ← covers both
  Txn 1: User → User (0 ALGO, fee = 0)                  ← free ride
```

## Deployed Contracts (TestNet)

### V2 (Cross-Contract Enabled — Production Architecture)

```
V2_CAMPAIGN_APP_ID=758809461
V2_SETTLEMENT_APP_ID=758809462
V2_PAYMASTER_APP_ID=758809463
V2_ATTESTATION_APP_ID=758809473
```

### V1 (Simple — No Cross-Contract Calls)

```
CAMPAIGN_APP_ID=758808364
SETTLEMENT_APP_ID=758808374
PAYMASTER_APP_ID=758808375
ATTESTATION_APP_ID=758808376
```

## Project Structure

```
├── contracts/                    # AlgoPy smart contracts
│   ├── attestation_v2.py         #   Proof box storage
│   ├── campaign_v2.py            #   Budget management
│   ├── paymaster_v2.py           #   ALGO sponsorship payments
│   └── settlement_v2.py          #   Orchestrator (inner txn chain)
├── scripts/
│   ├── deploy.py                 # Deploy all 4 contracts
│   └── generate_clients.py       # Generate typed Python clients
├── fe+be/algo/                   # Next.js frontend + API
│   ├── app/
│   │   ├── page.tsx              #   Demo: wallet, ad modal, dashboard
│   │   └── api/
│   │       ├── sponsor/route.ts  #   Fee-pooled tx builder
│   │       ├── campaign/route.ts #   Campaign budget read/write
│   │       ├── impression/route.ts # Proof status reader
│   │       └── stats/route.ts    #   Dashboard stats from Supabase
│   └── lib/
│       ├── algod.ts              #   Algod client helpers
│       ├── contracts.ts          #   TypeScript ABI wrappers (all methods)
│       └── supabase.ts           #   Supabase client (lazy, graceful fallback)
├── agent/
│   ├── agent.py                  # FastAPI settlement agent + Supabase logging
│   └── requirements.txt
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql # DB schema (campaigns, impressions, users, sponsored_txns)
├── CONTRACTS.md                  # Full contract documentation
└── artifacts/                    # Compiled TEAL + ARC56 specs
```

## Tech Stack

| Layer | Tech |
|---|---|
| Blockchain | Algorand TestNet |
| Contracts | AlgoPy (ARC4) |
| Frontend | Next.js 16, Tailwind, Pera Wallet Connect |
| Backend APIs | Next.js Route Handlers |
| Settlement Agent | Python FastAPI |
| Database | Supabase (PostgreSQL) |
| SDK | algosdk v3 (TS), py-algorand-sdk (Python) |
| Tooling | AlgoKit, Poetry |

## Getting Started

### 1. Install Dependencies

```bash
# Smart contracts (Python)
poetry install

# Frontend (Node)
cd fe+be/algo && pnpm install

# Agent (Python)
cd agent && pip install -r requirements.txt
```

### 2. Set Environment Variables

Create `fe+be/algo/.env.local`:

```env
NEXT_PUBLIC_ALGOD_SERVER=https://testnet-api.algonode.cloud
NEXT_PUBLIC_INDEXER_SERVER=https://testnet-idx.algonode.cloud
NEXT_PUBLIC_AGENT_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://pplfvsxxyjnafppllopd.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your supabase anon key>
SUPABASE_SERVICE_ROLE_KEY=<your supabase service role key>
SPONSOR_MNEMONIC=<25-word mnemonic for fee sponsor account>
CAMPAIGN_APP_ID=758809461
ATTESTATION_APP_ID=758809473
PRIVATE_KEY=<admin private key>
```

Create `agent/.env` (or export):

```env
ALGOD_SERVER=https://testnet-api.algonode.cloud
PRIVATE_KEY=<admin private key>
CAMPAIGN_APP_ID=758809461
SETTLEMENT_APP_ID=758809462
ATTESTATION_APP_ID=758809473
PAYMASTER_APP_ID=758809463
SUPABASE_URL=https://pplfvsxxyjnafppllopd.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your supabase service role key>
```

### 2b. Set Up Supabase Database

Run the migration in your Supabase SQL editor (or with the Supabase CLI):

```bash
# Option 1: Supabase CLI
supabase db push

# Option 2: Copy-paste supabase/migrations/001_initial_schema.sql into the SQL editor
```

This creates 4 tables: `campaigns`, `impressions`, `sponsored_txns`, `users` with RLS policies.

### 3. Run

```bash
# Terminal 1 — Frontend
cd fe+be/algo && pnpm dev

# Terminal 2 — Settlement Agent
cd agent && uvicorn agent:app --reload --port 8000
```

### 4. Demo Flow

1. Open `http://localhost:3000`
2. Connect Pera Wallet (use a testnet account with 0 ALGO)
3. Click "Send Transaction"
4. Watch the 15-second ad
5. Click "Claim Free Gas"
6. Sign the transaction in Pera
7. Transaction confirms — you paid 0 fees

## Compile & Deploy Contracts

```bash
# Compile AlgoPy → TEAL
algokit compile python contracts

# Generate typed clients
python scripts/generate_clients.py

# Deploy to testnet
python scripts/deploy.py
```

## Network

- **Network:** Algorand TestNet
- **Algod RPC:** `https://testnet-api.algonode.cloud`
- **Indexer:** `https://testnet-idx.algonode.cloud`
- **Explorer:** `https://testnet.explorer.perawallet.app`
