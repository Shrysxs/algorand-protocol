# GhostGas

GhostGas is a minimal Algorand smart contract backend written in Python 3.12, with ARC4 contracts, generated typed clients, and TestNet deployment scripts.

## Tech Stack

- Python 3.12
- Poetry
- `algopy` (ARC4 contracts)
- `algokit-utils`
- `py-algorand-sdk`
- `algokit-client-generator`

## Project Layout

- `contracts/` - ARC4 smart contracts
- `contracts/artifacts/` - compiled TEAL + ARC56 specs
- `scripts/` - compile/deploy/generate helpers
- `artifacts/` - generated Python client files for app integration

## Install

Run all commands from the project root (`ghostgas/`).

```bash
poetry install
```

## Compile Contracts

Compile all contracts and generate TEAL + ARC56 specs:

```bash
poetry run algokit compile python contracts
```

This creates `*.arc56.json` and TEAL outputs under `contracts/artifacts/`.

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

## App IDs and Frontend Integration

Each deployed Algorand app gets an **App ID** (an on-chain application identifier).  
Your frontend uses these IDs to call the correct contract instance on TestNet.

Recommended handoff flow:

1. Run deployment and capture all four App IDs.
2. Store them in frontend environment config (for example `.env` in the web app).
3. Initialize generated clients from `artifacts/` with:
   - algod/indexer network config
   - signer/wallet provider
   - the target App ID per contract
4. Route user actions (campaign budget, attestations, settlement, sponsorship) through these typed clients.
