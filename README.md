# GhostGas

## Project Overview

GhostGas is a modular ad-tech protocol on Algorand that enables:

- ad impression verification
- budget-controlled campaign spending
- publisher payouts
- gas sponsorship abstraction

## Tech Stack

- Algorand (TestNet)
- Algopy (ARC4 contracts)
- AlgoKit
- Python
- py-algorand-sdk

## Project Structure

- `contracts/` -> smart contracts (Campaign, Settlement, Paymaster, Attestation)
- `scripts/` -> deployment and client generation
- `artifacts/` -> generated clients and specs

## Deployed Contracts

### V1 (Simple Contracts)

```text
CAMPAIGN_APP_ID=758808364
SETTLEMENT_APP_ID=758808374
PAYMASTER_APP_ID=758808375
ATTESTATION_APP_ID=758808376
```

Description:

- Basic version
- No cross-contract calls
- Used for initial testing and stable demo

### V2 (Cross-Contract Enabled)

```text
V2_CAMPAIGN_APP_ID=758809461
V2_SETTLEMENT_APP_ID=758809462
V2_PAYMASTER_APP_ID=758809463
V2_ATTESTATION_APP_ID=758809473
```

Description:

- Advanced version with composability
- Settlement orchestrates full flow:
  - verifies attestation
  - deducts campaign budget
  - splits payout to publisher
  - funds paymaster
- Represents production-ready architecture

## Network Configuration

- Network: Algorand TestNet
- Algod RPC: `https://testnet-api.algonode.cloud`

## How to Run Locally

Install dependencies:

```bash
poetry install
```

Compile contracts:

```bash
algokit compile python contracts
```

Generate clients:

```bash
python scripts/generate_clients.py
```

Deploy contracts:

```bash
python scripts/deploy.py
```

## Integration Notes (For Fullstack Dev)

- Use App IDs to interact with contracts
- These are Algorand Application IDs (not wallet addresses)
- Use generated Python clients or SDK (frontend/backend)

To derive contract address:

```python
from algosdk.logic import get_application_address
```

## Recommended Usage

- Use V1 for stable demo flows
- Use V2 for advanced logic and full pipeline

## Future Improvements

- wallet integration (Pera / Defly)
- frontend dashboard
- real attestation oracle
- mainnet deployment
