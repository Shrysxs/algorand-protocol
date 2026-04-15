import algosdk from "algosdk";

// ---------------------------------------------------------------------------
// ABI Definitions
// ---------------------------------------------------------------------------

const campaignABI = new algosdk.ABIContract({
  name: "CampaignV2Contract",
  methods: [
    {
      name: "deposit_budget",
      args: [{ name: "amount", type: "uint64" }],
      returns: { type: "void" },
    },
    {
      name: "deduct",
      args: [],
      returns: { type: "uint64" },
    },
    {
      name: "deduct_for_impression",
      args: [],
      returns: { type: "uint64" },
    },
    {
      name: "get_budget",
      args: [],
      returns: { type: "uint64" },
    },
  ],
});

const attestationABI = new algosdk.ABIContract({
  name: "AttestationV2Contract",
  methods: [
    {
      name: "record_attestation",
      args: [{ name: "proof_id", type: "byte[]" }],
      returns: { type: "void" },
    },
    {
      name: "consume_attestation",
      args: [{ name: "proof_id", type: "byte[]" }],
      returns: { type: "uint64" },
    },
    {
      name: "validate_and_consume",
      args: [{ name: "proof_id", type: "byte[]" }],
      returns: { type: "uint64" },
    },
  ],
});

const paymasterABI = new algosdk.ABIContract({
  name: "PaymasterV2Contract",
  methods: [
    {
      name: "fund",
      args: [{ name: "amount", type: "uint64" }],
      returns: { type: "void" },
    },
    {
      name: "receive_funds",
      args: [{ name: "amount", type: "uint64" }],
      returns: { type: "void" },
    },
    {
      name: "sponsor",
      args: [
        { name: "user", type: "address" },
        { name: "amount", type: "uint64" },
      ],
      returns: { type: "void" },
    },
    {
      name: "grant_sponsorship",
      args: [{ name: "user", type: "address" }],
      returns: { type: "void" },
    },
  ],
});

const settlementABI = new algosdk.ABIContract({
  name: "SettlementV2Contract",
  methods: [
    {
      name: "set_campaign",
      args: [{ name: "app_id", type: "uint64" }],
      returns: { type: "void" },
    },
    {
      name: "set_attestation",
      args: [{ name: "app_id", type: "uint64" }],
      returns: { type: "void" },
    },
    {
      name: "set_paymaster",
      args: [{ name: "app_id", type: "uint64" }],
      returns: { type: "void" },
    },
    {
      name: "settle",
      args: [
        { name: "amount", type: "uint64" },
        { name: "publisher", type: "address" },
      ],
      returns: { type: "void" },
    },
    {
      name: "settle_with_proof",
      args: [
        { name: "amount", type: "uint64" },
        { name: "publisher", type: "address" },
        { name: "proof_id", type: "byte[]" },
        { name: "user", type: "address" },
      ],
      returns: { type: "void" },
    },
  ],
});

export { campaignABI, attestationABI, paymasterABI, settlementABI };

// ---------------------------------------------------------------------------
// Helper: build a basic ABI method call transaction
// ---------------------------------------------------------------------------

function getMethod(
  contract: algosdk.ABIContract,
  name: string
): algosdk.ABIMethod {
  const m = contract.getMethodByName(name);
  if (!m) throw new Error(`Method ${name} not found on ${contract.name}`);
  return m;
}

// ---------------------------------------------------------------------------
// Campaign wrappers
// ---------------------------------------------------------------------------

export async function depositBudget(
  client: algosdk.Algodv2,
  sender: string,
  signer: algosdk.TransactionSigner,
  appId: number,
  amount: number | bigint
) {
  const atc = new algosdk.AtomicTransactionComposer();
  const params = await client.getTransactionParams().do();
  atc.addMethodCall({
    appID: appId,
    method: getMethod(campaignABI, "deposit_budget"),
    methodArgs: [amount],
    sender,
    suggestedParams: params,
    signer,
  });
  const result = await atc.execute(client, 4);
  return result;
}

export async function getBudget(
  client: algosdk.Algodv2,
  sender: string,
  signer: algosdk.TransactionSigner,
  appId: number
): Promise<bigint> {
  const atc = new algosdk.AtomicTransactionComposer();
  const params = await client.getTransactionParams().do();
  atc.addMethodCall({
    appID: appId,
    method: getMethod(campaignABI, "get_budget"),
    methodArgs: [],
    sender,
    suggestedParams: params,
    signer,
  });
  const result = await atc.execute(client, 4);
  return result.methodResults[0].returnValue as bigint;
}

export async function deductForImpression(
  client: algosdk.Algodv2,
  sender: string,
  signer: algosdk.TransactionSigner,
  appId: number
): Promise<bigint> {
  const atc = new algosdk.AtomicTransactionComposer();
  const params = await client.getTransactionParams().do();
  atc.addMethodCall({
    appID: appId,
    method: getMethod(campaignABI, "deduct_for_impression"),
    methodArgs: [],
    sender,
    suggestedParams: params,
    signer,
  });
  const result = await atc.execute(client, 4);
  return result.methodResults[0].returnValue as bigint;
}

// ---------------------------------------------------------------------------
// Attestation wrappers
// ---------------------------------------------------------------------------

export async function recordAttestation(
  client: algosdk.Algodv2,
  sender: string,
  signer: algosdk.TransactionSigner,
  appId: number,
  proofId: Uint8Array
) {
  const atc = new algosdk.AtomicTransactionComposer();
  const params = await client.getTransactionParams().do();
  atc.addMethodCall({
    appID: appId,
    method: getMethod(attestationABI, "record_attestation"),
    methodArgs: [proofId],
    sender,
    suggestedParams: params,
    signer,
    boxes: [{ appIndex: appId, name: new Uint8Array([...Buffer.from("proof:"), ...proofId]) }],
  });
  const result = await atc.execute(client, 4);
  return result;
}

export async function consumeAttestation(
  client: algosdk.Algodv2,
  sender: string,
  signer: algosdk.TransactionSigner,
  appId: number,
  proofId: Uint8Array
): Promise<bigint> {
  const atc = new algosdk.AtomicTransactionComposer();
  const params = await client.getTransactionParams().do();
  atc.addMethodCall({
    appID: appId,
    method: getMethod(attestationABI, "consume_attestation"),
    methodArgs: [proofId],
    sender,
    suggestedParams: params,
    signer,
    boxes: [{ appIndex: appId, name: new Uint8Array([...Buffer.from("proof:"), ...proofId]) }],
  });
  const result = await atc.execute(client, 4);
  return result.methodResults[0].returnValue as bigint;
}

export async function validateAndConsume(
  client: algosdk.Algodv2,
  sender: string,
  signer: algosdk.TransactionSigner,
  appId: number,
  proofId: Uint8Array
): Promise<bigint> {
  const atc = new algosdk.AtomicTransactionComposer();
  const params = await client.getTransactionParams().do();
  atc.addMethodCall({
    appID: appId,
    method: getMethod(attestationABI, "validate_and_consume"),
    methodArgs: [proofId],
    sender,
    suggestedParams: params,
    signer,
    boxes: [{ appIndex: appId, name: new Uint8Array([...Buffer.from("proof:"), ...proofId]) }],
  });
  const result = await atc.execute(client, 4);
  return result.methodResults[0].returnValue as bigint;
}

// ---------------------------------------------------------------------------
// Paymaster wrappers
// ---------------------------------------------------------------------------

export async function fundPaymaster(
  client: algosdk.Algodv2,
  sender: string,
  signer: algosdk.TransactionSigner,
  appId: number,
  amount: number | bigint
) {
  const atc = new algosdk.AtomicTransactionComposer();
  const params = await client.getTransactionParams().do();
  atc.addMethodCall({
    appID: appId,
    method: getMethod(paymasterABI, "fund"),
    methodArgs: [amount],
    sender,
    suggestedParams: params,
    signer,
  });
  return atc.execute(client, 4);
}

export async function receiveFunds(
  client: algosdk.Algodv2,
  sender: string,
  signer: algosdk.TransactionSigner,
  appId: number,
  amount: number | bigint
) {
  const atc = new algosdk.AtomicTransactionComposer();
  const params = await client.getTransactionParams().do();
  atc.addMethodCall({
    appID: appId,
    method: getMethod(paymasterABI, "receive_funds"),
    methodArgs: [amount],
    sender,
    suggestedParams: params,
    signer,
  });
  return atc.execute(client, 4);
}

export async function sponsorUser(
  client: algosdk.Algodv2,
  sender: string,
  signer: algosdk.TransactionSigner,
  appId: number,
  user: string,
  amount: number | bigint
) {
  const atc = new algosdk.AtomicTransactionComposer();
  const params = await client.getTransactionParams().do();
  atc.addMethodCall({
    appID: appId,
    method: getMethod(paymasterABI, "sponsor"),
    methodArgs: [user, amount],
    sender,
    suggestedParams: params,
    signer,
  });
  return atc.execute(client, 4);
}

export async function grantSponsorship(
  client: algosdk.Algodv2,
  sender: string,
  signer: algosdk.TransactionSigner,
  appId: number,
  user: string
) {
  const atc = new algosdk.AtomicTransactionComposer();
  const params = await client.getTransactionParams().do();
  atc.addMethodCall({
    appID: appId,
    method: getMethod(paymasterABI, "grant_sponsorship"),
    methodArgs: [user],
    sender,
    suggestedParams: params,
    signer,
  });
  return atc.execute(client, 4);
}

// ---------------------------------------------------------------------------
// Settlement wrappers
// ---------------------------------------------------------------------------

export async function setCampaign(
  client: algosdk.Algodv2,
  sender: string,
  signer: algosdk.TransactionSigner,
  appId: number,
  campaignAppId: number | bigint
) {
  const atc = new algosdk.AtomicTransactionComposer();
  const params = await client.getTransactionParams().do();
  atc.addMethodCall({
    appID: appId,
    method: getMethod(settlementABI, "set_campaign"),
    methodArgs: [campaignAppId],
    sender,
    suggestedParams: params,
    signer,
  });
  return atc.execute(client, 4);
}

export async function setAttestation(
  client: algosdk.Algodv2,
  sender: string,
  signer: algosdk.TransactionSigner,
  appId: number,
  attestationAppId: number | bigint
) {
  const atc = new algosdk.AtomicTransactionComposer();
  const params = await client.getTransactionParams().do();
  atc.addMethodCall({
    appID: appId,
    method: getMethod(settlementABI, "set_attestation"),
    methodArgs: [attestationAppId],
    sender,
    suggestedParams: params,
    signer,
  });
  return atc.execute(client, 4);
}

export async function setPaymaster(
  client: algosdk.Algodv2,
  sender: string,
  signer: algosdk.TransactionSigner,
  appId: number,
  paymasterAppId: number | bigint
) {
  const atc = new algosdk.AtomicTransactionComposer();
  const params = await client.getTransactionParams().do();
  atc.addMethodCall({
    appID: appId,
    method: getMethod(settlementABI, "set_paymaster"),
    methodArgs: [paymasterAppId],
    sender,
    suggestedParams: params,
    signer,
  });
  return atc.execute(client, 4);
}

export async function settle(
  client: algosdk.Algodv2,
  sender: string,
  signer: algosdk.TransactionSigner,
  appId: number,
  amount: number | bigint,
  publisher: string
) {
  const atc = new algosdk.AtomicTransactionComposer();
  const params = await client.getTransactionParams().do();
  atc.addMethodCall({
    appID: appId,
    method: getMethod(settlementABI, "settle"),
    methodArgs: [amount, publisher],
    sender,
    suggestedParams: params,
    signer,
  });
  return atc.execute(client, 4);
}

export async function settleWithProof(
  client: algosdk.Algodv2,
  sender: string,
  signer: algosdk.TransactionSigner,
  appId: number,
  amount: number | bigint,
  publisher: string,
  proofId: Uint8Array,
  user: string,
  foreignApps: { attestationAppId: number; campaignAppId: number; paymasterAppId: number }
) {
  const atc = new algosdk.AtomicTransactionComposer();
  const params = await client.getTransactionParams().do();
  atc.addMethodCall({
    appID: appId,
    method: getMethod(settlementABI, "settle_with_proof"),
    methodArgs: [amount, publisher, proofId, user],
    sender,
    suggestedParams: params,
    signer,
    appForeignApps: [
      foreignApps.attestationAppId,
      foreignApps.campaignAppId,
      foreignApps.paymasterAppId,
    ],
    boxes: [
      {
        appIndex: foreignApps.attestationAppId,
        name: new Uint8Array([...Buffer.from("proof:"), ...proofId]),
      },
    ],
  });
  return atc.execute(client, 4);
}
