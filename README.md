# GhostGas

GhostGas is a minimal Algorand on-chain backend built with Algorand Python (Puya/ARC4).  
It provides campaign budgeting, proof attestation, settlement, and gas sponsorship contracts for full-stack integration.

## Tech Stack

- Python 3.12
- Poetry
- `algopy` (ARC4 contracts)
- `algokit-utils`
- `py-algorand-sdk`
- `algokit-client-generator`

## Project Layout

- `contracts/` - ARC4 smart contracts
- `contracts/*.py` - contract source files
- `scripts/` - compile/deploy/generate helpers
- `artifacts/contracts/` - compiled TEAL + ARC56 specs
- `artifacts/` - generated Python client files for app integration

## Install

Run all commands from the project root (`ghostgas/`).

```bash
poetry install
```

## Contracts Overview

### `CampaignContract`

- Stores advertiser, budget, and cost-per-impression
- `deposit_budget(amount)` adds campaign budget
- `deduct()` keeps original admin-controlled deduction flow
- `deduct_for_impression()` supports cross-contract deduction from settlement
- `get_budget()` returns current budget

### `AttestationContract`

- Stores verifier and proof existence in `BoxMap`
- `record_attestation(proof_id)` records proof
- `consume_attestation(proof_id)` keeps original verifier-only flow
- `validate_and_consume(proof_id)` validates+consumes proof for settlement flow

### `SettlementContract`

- Stores admin, `publisher_bps`, and linked app IDs:
  - `campaign_app_id`
  - `attestation_app_id`
  - `paymaster_app_id`
- `settle(amount, publisher)` original direct split behavior
- `set_campaign(app_id)`, `set_attestation(app_id)`, `set_paymaster(app_id)` link deployed apps
- `settle_with_proof(amount, publisher, proof_id, user)` orchestrates cross-contract validation, campaign deduction, split payment, and paymaster funding/sponsorship

### `PaymasterContract`

- Stores admin and internal sponsor balance
- `fund(amount)` keeps original admin funding flow
- `receive_funds(amount)` supports settlement funding path
- `sponsor(user, amount)` keeps original sponsor logic
- `grant_sponsorship(user)` grants small sponsorship from internal balance

## Compile Contracts

Compile all contracts and generate TEAL + ARC56 specs:

```bash
poetry run algokit compile python contracts --out-dir "$(pwd)/artifacts/contracts"
```

This generates `*.approval.teal`, `*.clear.teal`, and `*.arc56.json` in `artifacts/contracts/`.

## Generate Typed Clients

Generate Python clients from ARC56 specs:

```bash
poetry run python3 scripts/generate_clients.py
```

Expected outputs in `artifacts/`:

- `campaign_client.py`
- `attestation_client.py`
- `settlement_client.py`
- `paymaster_client.py`

## Deploy to Algorand TestNet

1. Copy and fill environment values:

```bash
cp .env.example .env
```

Required:

- `PRIVATE_KEY` (deployer account private key)
- `ALGOD_SERVER` (defaults to TestNet endpoint in `.env.example`)
- `ALGOD_TOKEN` (empty for AlgoNode, set if your provider requires one)
- `ALGOD_PORT` (optional)

2. Deploy all four contracts:

```bash
poetry run python3 scripts/deploy.py
```

The script prints:

```text
CAMPAIGN_APP_ID=...
SETTLEMENT_APP_ID=...
PAYMASTER_APP_ID=...
ATTESTATION_APP_ID=...
```

## Link Contract App IDs (Required for Cross-Contract Settlement)

After deployment, call settlement setters once (admin account):

- `set_campaign(CAMPAIGN_APP_ID)`
- `set_attestation(ATTESTATION_APP_ID)`
- `set_paymaster(PAYMASTER_APP_ID)`

Without this linking step, `settle_with_proof(...)` will fail by design.

## Full Command Flow

Run these from project root:

```bash
poetry install
cp .env.example .env
poetry run algokit compile python contracts --out-dir "$(pwd)/artifacts/contracts"
poetry run python3 scripts/generate_clients.py
poetry run python3 scripts/deploy.py
```

## App IDs and Frontend Integration

Each deployed app has a unique **App ID** on TestNet.  
Frontend/backend must use these IDs to route calls to the correct on-chain contracts.

Recommended handoff flow:

1. Deploy and capture:
   - `CAMPAIGN_APP_ID`
   - `SETTLEMENT_APP_ID`
   - `PAYMASTER_APP_ID`
   - `ATTESTATION_APP_ID`
2. Save them in frontend/backend env config.
3. Initialize generated typed clients from `artifacts/` with:
   - network client config
   - signer/wallet
   - per-contract App ID
4. Admin links app IDs in `SettlementContract` using setter methods.
5. App flow:
   - backend records attestation
   - settlement `settle_with_proof(...)` validates proof, deducts campaign budget, pays publisher/admin, and funds/grants sponsorship via paymaster
