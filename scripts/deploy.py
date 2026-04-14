import base64
import os
from pathlib import Path

import algokit_utils
from algosdk import account, transaction
from algosdk.v2client import algod

ROOT_DIR = Path(__file__).resolve().parent.parent


def load_env_file(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


def get_env(name: str, *, default: str | None = None, required: bool = False) -> str:
    value = os.getenv(name, default)
    if required and not value:
        raise ValueError(f"Missing required environment variable: {name}")
    return value or ""


def algod_address() -> str:
    server = get_env("ALGOD_SERVER", default="https://testnet-api.algonode.cloud")
    port = get_env("ALGOD_PORT", default="")
    if port and not server.rstrip("/").endswith(f":{port}"):
        return f"{server.rstrip('/')}:{port}"
    return server


def read_teal(path: Path) -> str:
    if not path.exists():
        raise FileNotFoundError(f"Missing TEAL file: {path}")
    return path.read_text(encoding="utf-8")


def compile_program(client: algod.AlgodClient, source: str) -> bytes:
    compiled = client.compile(source)
    return base64.b64decode(compiled["result"])


def deploy_contract(
    client: algod.AlgodClient,
    sender: str,
    private_key: str,
    approval_path: Path,
    clear_path: Path,
) -> int:
    approval_program = compile_program(client, read_teal(approval_path))
    clear_program = compile_program(client, read_teal(clear_path))
    params = client.suggested_params()

    txn = transaction.ApplicationCreateTxn(
        sender=sender,
        sp=params,
        on_complete=transaction.OnComplete.NoOpOC,
        approval_program=approval_program,
        clear_program=clear_program,
        global_schema=transaction.StateSchema(num_uints=8, num_byte_slices=8),
        local_schema=transaction.StateSchema(num_uints=0, num_byte_slices=0),
    )

    txid = client.send_transaction(txn.sign(private_key))
    confirmed = transaction.wait_for_confirmation(client, txid, 8)
    app_id = confirmed.get("application-index")
    if not isinstance(app_id, int):
        raise RuntimeError(f"Deployment failed for {approval_path.name}, txid={txid}")
    return app_id


def main() -> None:
    load_env_file(ROOT_DIR / ".env")

    # Explicitly touch algokit-utils so deployments fail fast if dependency is missing.
    _ = algokit_utils.__name__

    private_key = get_env("PRIVATE_KEY", required=True)
    algod_client = algod.AlgodClient(
        algod_token=get_env("ALGOD_TOKEN", default=""),
        algod_address=algod_address(),
        headers={"User-Agent": "ghostgas-deployer/1.0"},
    )
    sender = account.address_from_private_key(private_key)

    artifact_dir = ROOT_DIR / "contracts" / "artifacts"
    contracts = {
        "CAMPAIGN_APP_ID": "CampaignContract",
        "SETTLEMENT_APP_ID": "SettlementContract",
        "PAYMASTER_APP_ID": "PaymasterContract",
        "ATTESTATION_APP_ID": "AttestationContract",
    }

    results: dict[str, int] = {}
    for env_key, contract_name in contracts.items():
        app_id = deploy_contract(
            client=algod_client,
            sender=sender,
            private_key=private_key,
            approval_path=artifact_dir / f"{contract_name}.approval.teal",
            clear_path=artifact_dir / f"{contract_name}.clear.teal",
        )
        results[env_key] = app_id

    print(f"CAMPAIGN_APP_ID={results['CAMPAIGN_APP_ID']}")
    print(f"SETTLEMENT_APP_ID={results['SETTLEMENT_APP_ID']}")
    print(f"PAYMASTER_APP_ID={results['PAYMASTER_APP_ID']}")
    print(f"ATTESTATION_APP_ID={results['ATTESTATION_APP_ID']}")


if __name__ == "__main__":
    main()
