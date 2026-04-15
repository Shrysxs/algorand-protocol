# GhostGas Smart Contracts Documentation

## Overview

GhostGas is an ad-sponsored gas abstraction layer for Algorand. Four contracts work together to let users with 0 ALGO transact by watching ads. An autonomous agent settles impressions on-chain, and a sponsor covers transaction fees via fee pooling.

---

## Contract 1: AttestationV2Contract

**File:** `contracts/attestation_v2.py`

### Global State

| Variable   | Type    | Description                              |
|------------|---------|------------------------------------------|
| `verifier` | Address | Deployer address. Only account that can write proofs. |

### Box Storage

| Key Prefix | Key Type | Value Type | Description                          |
|------------|----------|------------|--------------------------------------|
| `proof:`   | Bytes    | UInt64     | Maps proof IDs to status (1 = valid) |

### Methods

| Method                  | Caller         | Description                                                     |
|-------------------------|----------------|-----------------------------------------------------------------|
| `record_attestation(proof_id: DynamicBytes)` | verifier only | Creates a new proof entry with value 1                  |
| `consume_attestation(proof_id: DynamicBytes) -> UInt64` | verifier only | Asserts proof == 1, deletes it, returns 1      |
| `validate_and_consume(proof_id: DynamicBytes) -> UInt64` | anyone (inner call) | Same as consume but no sender check — designed for Settlement inner calls |

### Inner Transactions

None.

---

## Contract 2: CampaignV2Contract

**File:** `contracts/campaign_v2.py`

### Global State

| Variable             | Type    | Description                                   |
|----------------------|---------|-----------------------------------------------|
| `advertiser`         | Address | Deployer address. Only account that can deposit. |
| `budget`             | UInt64  | Impression budget counter (abstract units, not ALGO) |
| `cost_per_impression`| UInt64  | Hardcoded to 1                                |

### Methods

| Method                              | Caller          | Description                                    |
|-------------------------------------|-----------------|------------------------------------------------|
| `deposit_budget(amount: UInt64)`    | advertiser only | Adds `amount` to budget counter                |
| `deduct() -> UInt64`               | advertiser only | Deducts `cost_per_impression` from budget, returns cost |
| `deduct_for_impression() -> UInt64` | anyone (inner call) | Same as deduct but no sender check — for Settlement |
| `get_budget() -> UInt64`           | anyone          | Read-only, returns current budget              |

### Inner Transactions

None.

---

## Contract 3: PaymasterV2Contract

**File:** `contracts/paymaster_v2.py`

### Global State

| Variable  | Type    | Description                                      |
|-----------|---------|--------------------------------------------------|
| `admin`   | Address | Deployer address. Controls fund and sponsor ops. |
| `balance` | UInt64  | Internal ALGO balance tracker (microALGO)        |

### Methods

| Method                                  | Caller      | Description                                                    |
|-----------------------------------------|-------------|----------------------------------------------------------------|
| `fund(amount: UInt64)`                  | admin only  | Adds `amount` to internal balance counter                      |
| `receive_funds(amount: UInt64)`         | anyone (inner call) | Adds `amount` to balance — for Settlement inner calls  |
| `sponsor(user: Address, amount: UInt64)`| admin only  | Deducts `amount`, sends ALGO payment to user                   |
| `grant_sponsorship(user: Address)`      | anyone (inner call) | Deducts 1 microALGO, sends 1 microALGO to user — for Settlement |

### Inner Transactions

| Method               | Transaction Type | From      | To   | Amount           |
|----------------------|-----------------|-----------|------|------------------|
| `sponsor`            | Payment         | Contract  | user | `amount` microALGO |
| `grant_sponsorship`  | Payment         | Contract  | user | 1 microALGO      |

---

## Contract 4: SettlementV2Contract (Orchestrator)

**File:** `contracts/settlement_v2.py`

### Global State

| Variable             | Type    | Description                                    |
|----------------------|---------|------------------------------------------------|
| `admin`              | Address | Deployer address. Controls all settlement ops. |
| `publisher_bps`      | UInt64  | 8000 = 80% to publisher, 20% to admin (protocol fee) |
| `campaign_app_id`    | UInt64  | Linked Campaign contract app ID                |
| `attestation_app_id` | UInt64  | Linked Attestation contract app ID             |
| `paymaster_app_id`   | UInt64  | Linked Paymaster contract app ID               |

### Methods

| Method | Caller | Description |
|--------|--------|-------------|
| `set_campaign(app_id: UInt64)` | admin only | Links the Campaign contract |
| `set_attestation(app_id: UInt64)` | admin only | Links the Attestation contract |
| `set_paymaster(app_id: UInt64)` | admin only | Links the Paymaster contract |
| `settle(amount: UInt64, publisher: Address)` | admin only | Splits `amount`: 80% to publisher, 20% to admin |
| `settle_with_proof(amount, publisher, proof_id, user)` | admin only | Full settlement pipeline (see below) |

### `settle_with_proof` Inner Transaction Chain

1. **abi_call -> AttestationV2.validate_and_consume(proof_id)** — verifies proof exists and deletes it
2. **abi_call -> CampaignV2.deduct_for_impression()** — decrements campaign budget by 1
3. **Payment -> publisher** — 80% of `amount` (publisher_bps / 10000)
4. **Payment -> admin** — 20% of `amount` (protocol fee)
5. **abi_call -> PaymasterV2.receive_funds(amount)** — credits paymaster balance
6. **abi_call -> PaymasterV2.grant_sponsorship(user)** — sends 1 microALGO to user

### Inner Transactions

| Step | Type           | From       | To          | Amount / Action             |
|------|----------------|------------|-------------|-----------------------------|
| 1    | App Call       | Settlement | Attestation | validate_and_consume        |
| 2    | App Call       | Settlement | Campaign    | deduct_for_impression       |
| 3    | Payment        | Settlement | publisher   | amount * 8000 / 10000       |
| 4    | Payment        | Settlement | admin       | amount - publisher_amount   |
| 5    | App Call       | Settlement | Paymaster   | receive_funds(amount)       |
| 6    | App Call       | Settlement | Paymaster   | grant_sponsorship(user)     |

---

## Authorization Matrix

| Action                    | Who Calls It              | Called By Frontend? | Called By Agent? |
|---------------------------|---------------------------|---------------------|------------------|
| `record_attestation`      | verifier (admin/agent)    | No                  | Yes              |
| `consume_attestation`     | verifier (admin/agent)    | No                  | No               |
| `validate_and_consume`    | Settlement (inner call)   | No                  | Indirectly       |
| `deposit_budget`          | advertiser                | Yes (admin)         | No               |
| `deduct`                  | advertiser                | No                  | No               |
| `deduct_for_impression`   | Settlement (inner call)   | No                  | Indirectly       |
| `get_budget`              | anyone                    | Yes                 | Yes              |
| `fund`                    | admin                     | Yes (admin)         | No               |
| `receive_funds`           | Settlement (inner call)   | No                  | Indirectly       |
| `sponsor`                 | admin                     | Yes (sponsor API)   | No               |
| `grant_sponsorship`       | Settlement (inner call)   | No                  | Indirectly       |
| `set_campaign`            | admin                     | No (setup only)     | No               |
| `set_attestation`         | admin                     | No (setup only)     | No               |
| `set_paymaster`           | admin                     | No (setup only)     | No               |
| `settle`                  | admin                     | No                  | Yes              |
| `settle_with_proof`       | admin                     | No                  | Yes              |

---

## End-to-End Flow

```
User (0 ALGO)                Frontend              Agent              Contracts
     |                          |                    |                    |
     |-- Connect Pera --------->|                    |                    |
     |<-- Show 0 balance -------|                    |                    |
     |-- Click "Transact" ----->|                    |                    |
     |<-- "Watch ad for gas" ---|                    |                    |
     |-- Watch 15s ad --------->|                    |                    |
     |                          |-- POST /complete ->|                    |
     |                          |                    |-- record_attestation ->|
     |                          |                    |-- settle_with_proof -->|
     |                          |                    |   (validates proof,    |
     |                          |                    |    deducts budget,     |
     |                          |                    |    pays publisher 80%, |
     |                          |                    |    protocol fee 20%,   |
     |                          |                    |    funds paymaster,    |
     |                          |                    |    grants 1uALGO)     |
     |                          |<-- success --------|                    |
     |                          |-- POST /sponsor -->|                    |
     |                          |   (build fee-pooled group)              |
     |<-- Sign user txn --------|                    |                    |
     |-- Submit group --------->|                    |                    |
     |<-- Tx confirmed (0 fee)->|                    |                    |
```
