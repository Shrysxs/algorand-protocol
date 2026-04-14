import shutil
import subprocess
import sys
import importlib.util
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parent.parent
CONTRACT_ARTIFACTS_DIR = ROOT_DIR / "artifacts" / "contracts"
OUTPUT_DIR = ROOT_DIR / "artifacts"

TARGET_OUTPUTS = {
    "CampaignV2Contract.arc56.json": "campaign_v2_client.py",
    "AttestationV2Contract.arc56.json": "attestation_v2_client.py",
    "SettlementV2Contract.arc56.json": "settlement_v2_client.py",
    "PaymasterV2Contract.arc56.json": "paymaster_v2_client.py",
}


def find_specs() -> dict[str, Path]:
    specs = {path.name: path for path in CONTRACT_ARTIFACTS_DIR.rglob("*.arc56.json")}
    missing = [name for name in TARGET_OUTPUTS if name not in specs]
    if missing:
        missing_str = ", ".join(missing)
        raise FileNotFoundError(f"Missing ARC56 specs under artifacts/contracts/: {missing_str}")
    return specs


def run_client_generator(spec_path: Path, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)

    commands = []
    cli_path = shutil.which("algokit-client-generator")
    if cli_path:
        commands.append([cli_path, "generate", "--input", str(spec_path), "--output", str(output_path)])

    commands.append(
        [
            sys.executable,
            "-m",
            "algokit_client_generator.cli",
            "generate",
            "--input",
            str(spec_path),
            "--output",
            str(output_path),
        ]
    )

    if not cli_path and importlib.util.find_spec("algokit_client_generator") is None:
        raise RuntimeError(
            "algokit-client-generator is not installed in the current Python environment. "
            "Install dependencies with `poetry install` and run via `poetry run python scripts/generate_clients.py`."
        )

    last_error: Exception | None = None
    for cmd in commands:
        try:
            subprocess.run(cmd, check=True)
            return
        except Exception as err:
            last_error = err

    raise RuntimeError(f"Failed to generate client for {spec_path.name}") from last_error


def main() -> None:
    specs = find_specs()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    for spec_name, client_name in TARGET_OUTPUTS.items():
        run_client_generator(specs[spec_name], OUTPUT_DIR / client_name)
        print(f"Generated {client_name}")


if __name__ == "__main__":
    main()
