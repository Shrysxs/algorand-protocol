from algopy import ARC4Contract, BoxMap, Bytes, Txn, UInt64, arc4


class AttestationContract(ARC4Contract):
    def __init__(self) -> None:
        self.verifier = Txn.sender
        self.proofs = BoxMap(Bytes, UInt64, key_prefix=b"proof:")

    @arc4.abimethod
    def record_attestation(self, proof_id: arc4.DynamicBytes) -> None:
        assert Txn.sender == self.verifier
        self.proofs[proof_id.native] = UInt64(1)

    @arc4.abimethod
    def consume_attestation(self, proof_id: arc4.DynamicBytes) -> arc4.UInt64:
        assert Txn.sender == self.verifier
        assert self.proofs[proof_id.native] == UInt64(1)
        del self.proofs[proof_id.native]
        return arc4.UInt64(1)
