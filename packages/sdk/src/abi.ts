import algosdk from "algosdk";

// ── Campaign ABI ──

export const campaignABI = new algosdk.ABIContract({
  name: "CampaignV2Contract",
  methods: [
    {
      name: "deposit_budget",
      args: [{ name: "amount", type: "uint64" }],
      returns: { type: "void" },
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

// ── Attestation ABI ──

export const attestationABI = new algosdk.ABIContract({
  name: "AttestationV2Contract",
  methods: [
    {
      name: "record_attestation",
      args: [{ name: "proof_id", type: "byte[]" }],
      returns: { type: "void" },
    },
    {
      name: "validate_and_consume",
      args: [{ name: "proof_id", type: "byte[]" }],
      returns: { type: "uint64" },
    },
  ],
});

// ── Paymaster ABI ──

export const paymasterABI = new algosdk.ABIContract({
  name: "PaymasterV2Contract",
  methods: [
    {
      name: "fund",
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
  ],
});

// ── Settlement ABI ──

export const settlementABI = new algosdk.ABIContract({
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
