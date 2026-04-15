import { NextRequest, NextResponse } from "next/server";
import { getAlgodClient } from "../../../lib/algod";

const ATTESTATION_APP_ID = Number(process.env.ATTESTATION_APP_ID ?? "0");

export async function GET(req: NextRequest) {
  try {
    if (!ATTESTATION_APP_ID) {
      return NextResponse.json(
        { error: "ATTESTATION_APP_ID not configured" },
        { status: 500 }
      );
    }

    const proofId = req.nextUrl.searchParams.get("proofId");
    if (!proofId) {
      return NextResponse.json(
        { error: "proofId query parameter is required" },
        { status: 400 }
      );
    }

    const client = getAlgodClient();

    // Box name is "proof:" + raw proof bytes
    const proofBytes = Buffer.from(proofId, "hex");
    const boxName = new Uint8Array(
      Buffer.concat([Buffer.from("proof:"), proofBytes])
    );

    try {
      const box = await client
        .getApplicationBoxByName(ATTESTATION_APP_ID, boxName)
        .do();
      // Value is a uint64 encoded as 8 bytes big-endian
      const value = box.value;
      const status = new DataView(
        new Uint8Array(value).buffer
      ).getBigUint64(0);
      return NextResponse.json({
        exists: true,
        proofId,
        status: Number(status),
      });
    } catch {
      // Box not found means proof doesn't exist or was consumed
      return NextResponse.json({
        exists: false,
        proofId,
        status: null,
      });
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
