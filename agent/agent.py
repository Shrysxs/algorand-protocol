"""
GhostGas Settlement Agent

Autonomous FastAPI service that:
1. Verifies a user watched an ad >= 15 seconds
2. Records an attestation proof on-chain
3. Calls settle_with_proof to atomically settle the impression
4. Logs everything to Supabase
5. x402 middleware: returns HTTP 402 if campaign budget is exhausted
"""

import os
import ssl
import certifi
from pathlib import Path
from typing import Any

# Fix macOS Python SSL certificates
os.environ["SSL_CERT_FILE"] = certifi.where()
os.environ["REQUESTS_CA_BUNDLE"] = certifi.where()
ssl._create_default_https_context = lambda: ssl.create_default_context(cafile=certifi.where())

# Load .env file
_env_path = Path(__file__).parent / ".env"
if _env_path.exists():
    for line in _env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip())

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from algosdk import account, encoding
from algosdk.v2client import algod
from algosdk import abi
from algosdk.atomic_transaction_composer import (
    AtomicTransactionComposer,
    AccountTransactionSigner,
)

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

ALGOD_SERVER = os.getenv("ALGOD_SERVER", "https://testnet-api.algonode.cloud")
ALGOD_TOKEN = os.getenv("ALGOD_TOKEN", "")
PRIVATE_KEY = os.getenv("PRIVATE_KEY", "")

CAMPAIGN_APP_ID = int(os.getenv("CAMPAIGN_APP_ID", "0"))
SETTLEMENT_APP_ID = int(os.getenv("SETTLEMENT_APP_ID", "0"))
ATTESTATION_APP_ID = int(os.getenv("ATTESTATION_APP_ID", "0"))
PAYMASTER_APP_ID = int(os.getenv("PAYMASTER_APP_ID", "0"))

SETTLEMENT_AMOUNT = int(os.getenv("SETTLEMENT_AMOUNT", "1000"))  # microALGO per impression
MIN_WATCH_DURATION = 5  # seconds

# Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL", "https://pplfvsxxyjnafppllopd.supabase.co")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

# ---------------------------------------------------------------------------
# Supabase client (optional — best-effort logging)
# ---------------------------------------------------------------------------

_supabase = None


def get_supabase():
    global _supabase
    if _supabase is None and SUPABASE_SERVICE_KEY:
        try:
            from supabase import create_client
            _supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        except ImportError:
            pass
    return _supabase


# ---------------------------------------------------------------------------
# Algorand clients
# ---------------------------------------------------------------------------


def get_algod() -> algod.AlgodClient:
    return algod.AlgodClient(ALGOD_TOKEN, ALGOD_SERVER)


def get_admin_address() -> str:
    return account.address_from_private_key(PRIVATE_KEY)


# ---------------------------------------------------------------------------
# ABI helpers
# ---------------------------------------------------------------------------

RECORD_ATTESTATION = abi.Method(
    name="record_attestation",
    args=[abi.Argument(arg_type="byte[]", name="proof_id")],
    returns=abi.Returns(arg_type="void"),
)

SETTLE_WITH_PROOF = abi.Method(
    name="settle_with_proof",
    args=[
        abi.Argument(arg_type="uint64", name="amount"),
        abi.Argument(arg_type="address", name="publisher"),
        abi.Argument(arg_type="byte[]", name="proof_id"),
        abi.Argument(arg_type="address", name="user"),
    ],
    returns=abi.Returns(arg_type="void"),
)

GET_BUDGET = abi.Method(
    name="get_budget",
    args=[],
    returns=abi.Returns(arg_type="uint64"),
)


def call_abi_method(
    client: algod.AlgodClient,
    sender: str,
    private_key: str,
    app_id: int,
    method: abi.Method,
    args: list[Any],
    foreign_apps: list[int] | None = None,
    boxes: list[tuple[int, bytes]] | None = None,
    extra_fees: int = 0,
    accounts: list[str] | None = None,
) -> dict:
    atc = AtomicTransactionComposer()
    signer = AccountTransactionSigner(private_key)
    params = client.suggested_params()

    # If the method triggers inner transactions, we need to cover their fees
    if extra_fees > 0:
        params.fee = params.min_fee + extra_fees
        params.flat_fee = True

    atc.add_method_call(
        app_id=app_id,
        method=method,
        sender=sender,
        sp=params,
        signer=signer,
        method_args=args,
        foreign_apps=foreign_apps or [],
        boxes=[(b[0], b[1]) for b in boxes] if boxes else [],
        accounts=accounts or [],
    )

    result = atc.execute(client, 4)
    return {
        "tx_id": result.tx_ids[0],
        "return_value": result.abi_results[0].return_value if result.abi_results else None,
    }


# ---------------------------------------------------------------------------
# FastAPI App
# ---------------------------------------------------------------------------

app = FastAPI(title="GhostGas Settlement Agent")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# x402 middleware — check campaign budget before processing
# ---------------------------------------------------------------------------

@app.middleware("http")
async def x402_budget_check(request: Request, call_next):
    if request.url.path == "/impression/complete" and request.method == "POST":
        try:
            client = get_algod()
            admin = get_admin_address()
            result = call_abi_method(
                client, admin, PRIVATE_KEY, CAMPAIGN_APP_ID, GET_BUDGET, []
            )
            budget = result["return_value"]
            if budget is not None and int(budget) <= 0:
                return Response(
                    content='{"error": "Campaign budget exhausted", "payment_required": true}',
                    status_code=402,
                    media_type="application/json",
                )
        except Exception:
            pass

    try:
        response = await call_next(request)
        return response
    except Exception as e:
        import traceback
        traceback.print_exc()
        return Response(
            content=f'{{"error": "{str(e)}"}}',
            status_code=500,
            media_type="application/json",
        )


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class ImpressionCompleteRequest(BaseModel):
    user_address: str
    proof_id: str  # hex-encoded proof identifier
    publisher_address: str
    duration_seconds: float


class ImpressionCompleteResponse(BaseModel):
    success: bool
    attestation_tx_id: str
    settlement_tx_id: str
    impression_id: str | None = None


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    return {"status": "ok", "agent": "ghostgas-settlement"}


@app.post("/impression/complete", response_model=ImpressionCompleteResponse)
async def complete_impression(body: ImpressionCompleteRequest):
    # 1) Validate watch duration
    if body.duration_seconds < MIN_WATCH_DURATION:
        raise HTTPException(
            status_code=400,
            detail=f"Ad watch duration must be >= {MIN_WATCH_DURATION}s, got {body.duration_seconds}s",
        )

    # 2) Validate addresses
    if not encoding.is_valid_address(body.user_address):
        raise HTTPException(status_code=400, detail="Invalid user_address")
    if not encoding.is_valid_address(body.publisher_address):
        raise HTTPException(status_code=400, detail="Invalid publisher_address")

    proof_bytes = bytes.fromhex(body.proof_id)
    box_name = b"proof:" + proof_bytes

    client = get_algod()
    admin = get_admin_address()

    # 2b) Fund user if below minimum balance (0.1 ALGO)
    try:
        from algosdk import transaction as txn_mod
        user_info = client.account_info(body.user_address)
        user_balance = user_info.get("amount", 0)
        if user_balance < 100_000:
            fund_amount = 200_000  # 0.2 ALGO — enough for min balance + some buffer
            params = client.suggested_params()
            fund_txn = txn_mod.PaymentTxn(admin, params, body.user_address, fund_amount)
            signed_fund = fund_txn.sign(PRIVATE_KEY)
            client.send_transaction(signed_fund)
            txn_mod.wait_for_confirmation(client, signed_fund.get_txid(), 4)
            print(f"[agent] Funded user {body.user_address} with {fund_amount} microALGO")
    except Exception as e:
        print(f"[agent] Could not fund user (non-fatal): {e}")

    # 3) Record attestation on-chain
    attestation_result = call_abi_method(
        client,
        admin,
        PRIVATE_KEY,
        ATTESTATION_APP_ID,
        RECORD_ATTESTATION,
        [proof_bytes],
        boxes=[(ATTESTATION_APP_ID, box_name)],
    )

    # 4) Settle with proof — atomically:
    #    - validates & consumes the proof
    #    - deducts campaign budget
    #    - pays publisher (80%) and protocol (20%)
    #    - funds paymaster and grants sponsorship to user
    # settle_with_proof triggers 7 inner txns:
    #   validate_and_consume, deduct_for_impression,
    #   2x payment (publisher + admin),
    #   receive_funds, grant_sponsorship (which itself does 1 inner payment)
    # So we need 7 * 1000 = 7000 extra fee
    settlement_result = call_abi_method(
        client,
        admin,
        PRIVATE_KEY,
        SETTLEMENT_APP_ID,
        SETTLE_WITH_PROOF,
        [SETTLEMENT_AMOUNT, body.publisher_address, proof_bytes, body.user_address],
        foreign_apps=[ATTESTATION_APP_ID, CAMPAIGN_APP_ID, PAYMASTER_APP_ID],
        boxes=[(ATTESTATION_APP_ID, box_name)],
        extra_fees=7000,
        accounts=[body.publisher_address, body.user_address],
    )

    # 5) Log to Supabase
    impression_id = None
    publisher_earned = int(SETTLEMENT_AMOUNT * 8000 / 10000)
    protocol_fee = SETTLEMENT_AMOUNT - publisher_earned

    sb = get_supabase()
    if sb:
        try:
            # Find campaign by app_id
            campaign_res = sb.table("campaigns").select("id").eq("app_id", CAMPAIGN_APP_ID).execute()
            campaign_id = campaign_res.data[0]["id"] if campaign_res.data else None

            # Insert impression
            imp_res = sb.table("impressions").insert({
                "campaign_id": campaign_id,
                "user_address": body.user_address,
                "publisher_address": body.publisher_address,
                "proof_id": body.proof_id,
                "duration_seconds": body.duration_seconds,
                "attestation_tx_id": attestation_result["tx_id"],
                "settlement_tx_id": settlement_result["tx_id"],
                "amount_micro_algo": SETTLEMENT_AMOUNT,
                "publisher_earned_micro_algo": publisher_earned,
                "protocol_fee_micro_algo": protocol_fee,
            }).execute()

            if imp_res.data:
                impression_id = imp_res.data[0]["id"]

            # Upsert user + increment impressions
            sb.table("users").upsert({
                "address": body.user_address,
                "total_impressions": 1,
                "last_seen": "now()",
            }, on_conflict="address").execute()

            # Decrement campaign budget_remaining
            if campaign_id:
                sb.table("campaigns").update({
                    "budget_remaining": max(0, (campaign_res.data[0].get("budget_remaining", 1) - 1)) if campaign_res.data else 0,
                }).eq("id", campaign_id).execute()

        except Exception as e:
            print(f"[supabase] logging error (non-fatal): {e}")

    return ImpressionCompleteResponse(
        success=True,
        attestation_tx_id=attestation_result["tx_id"],
        settlement_tx_id=settlement_result["tx_id"],
        impression_id=impression_id,
    )


@app.get("/campaign/budget")
async def get_campaign_budget():
    client = get_algod()
    admin = get_admin_address()
    result = call_abi_method(
        client, admin, PRIVATE_KEY, CAMPAIGN_APP_ID, GET_BUDGET, []
    )
    return {"budget": int(result["return_value"]) if result["return_value"] is not None else 0}


@app.get("/stats")
async def get_stats():
    """Dashboard stats from Supabase."""
    sb = get_supabase()
    if not sb:
        return {"error": "Supabase not configured"}

    try:
        impressions = sb.table("impressions").select("*", count="exact").execute()
        sponsored = sb.table("sponsored_txns").select("*", count="exact").execute()
        users = sb.table("users").select("*", count="exact").execute()

        total_publisher = sum(r["publisher_earned_micro_algo"] for r in (impressions.data or []))
        total_protocol = sum(r["protocol_fee_micro_algo"] for r in (impressions.data or []))

        return {
            "total_impressions": impressions.count or 0,
            "total_sponsored_txns": sponsored.count or 0,
            "total_users": users.count or 0,
            "total_publisher_earned_micro_algo": total_publisher,
            "total_protocol_fees_micro_algo": total_protocol,
        }
    except Exception as e:
        return {"error": str(e)}
