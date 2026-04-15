import { NextRequest, NextResponse } from "next/server";
import algosdk from "algosdk";
import { getAlgodClient, sponsorAccountFromMnemonic } from "../../../lib/algod";
import { getServiceSupabase } from "../../../lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const { userAddress, txnBytes, impressionId } = (await req.json()) as {
      userAddress: string;
      txnBytes: string; // base64-encoded unsigned transaction
      impressionId?: string; // optional — links to the impression that earned this sponsorship
    };

    if (!userAddress || !txnBytes) {
      return NextResponse.json(
        { error: "userAddress and txnBytes are required" },
        { status: 400 }
      );
    }

    const client = getAlgodClient();
    const sponsor = sponsorAccountFromMnemonic();
    const params = await client.getTransactionParams().do();

    // Decode the user's transaction
    const userTxnBytes = Buffer.from(txnBytes, "base64");
    const userTxn = algosdk.decodeUnsignedTransaction(userTxnBytes);

    const minFee = BigInt(params.minFee ?? 1000);

    // Sponsor txn: 0 ALGO to self, fee covers both transactions via fee pooling
    const sponsorTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: sponsor.addr.toString(),
      receiver: sponsor.addr.toString(),
      amount: BigInt(0),
      suggestedParams: { ...params, fee: minFee * BigInt(2), flatFee: true },
    });

    // Rebuild the user transaction with fee = 0
    const userTxnRebuilt = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: userTxn.sender.toString(),
      receiver: (userTxn as any).payment?.receiver?.toString() ?? userAddress,
      amount: (userTxn as any).payment?.amount ?? BigInt(0),
      suggestedParams: { ...params, fee: BigInt(0), flatFee: true },
      note: userTxn.note,
    });

    // Group the transactions
    const grouped = algosdk.assignGroupID([sponsorTxn, userTxnRebuilt]);

    // Sign the sponsor transaction
    const signedSponsorTxn = grouped[0].signTxn(sponsor.sk);

    // Log to Supabase
    try {
      const sb = getServiceSupabase();

      // Upsert user
      await sb.from("users").upsert(
        {
          address: userAddress,
          total_sponsored_txns: 1,
          last_seen: new Date().toISOString(),
        },
        { onConflict: "address" }
      );

      // Log the sponsored transaction
      await sb.from("sponsored_txns").insert({
        user_address: userAddress,
        fee_paid_micro_algo: Number(minFee * BigInt(2)),
        impression_id: impressionId || null,
      });
    } catch {
      // DB logging is best-effort — don't fail the sponsor flow
    }

    return NextResponse.json({
      groupTxns: [
        Buffer.from(signedSponsorTxn).toString("base64"),
        Buffer.from(algosdk.encodeUnsignedTransaction(grouped[1])).toString(
          "base64"
        ),
      ],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
