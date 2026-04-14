from algopy import ARC4Contract, Application, Txn, UInt64, arc4, itxn
from contracts.attestation_contract import AttestationContract
from contracts.campaign_contract import CampaignContract
from contracts.paymaster_contract import PaymasterContract


class SettlementContract(ARC4Contract):
    def __init__(self) -> None:
        self.admin = Txn.sender
        self.publisher_bps = UInt64(8000)
        self.campaign_app_id = UInt64(0)
        self.attestation_app_id = UInt64(0)
        self.paymaster_app_id = UInt64(0)

    @arc4.abimethod
    def set_campaign(self, app_id: arc4.UInt64) -> None:
        assert Txn.sender == self.admin
        assert app_id.native > UInt64(0)
        self.campaign_app_id = app_id.native

    @arc4.abimethod
    def set_attestation(self, app_id: arc4.UInt64) -> None:
        assert Txn.sender == self.admin
        assert app_id.native > UInt64(0)
        self.attestation_app_id = app_id.native

    @arc4.abimethod
    def set_paymaster(self, app_id: arc4.UInt64) -> None:
        assert Txn.sender == self.admin
        assert app_id.native > UInt64(0)
        self.paymaster_app_id = app_id.native

    @arc4.abimethod
    def settle(self, amount: arc4.UInt64, publisher: arc4.Address) -> None:
        assert Txn.sender == self.admin
        assert self.publisher_bps <= UInt64(10_000)

        publisher_amount = (amount.native * self.publisher_bps) // UInt64(10_000)
        admin_amount = amount.native - publisher_amount

        itxn.Payment(receiver=publisher.native, amount=publisher_amount).submit()
        itxn.Payment(receiver=self.admin, amount=admin_amount).submit()

    @arc4.abimethod
    def settle_with_proof(
        self,
        amount: arc4.UInt64,
        publisher: arc4.Address,
        proof_id: arc4.DynamicBytes,
        user: arc4.Address,
    ) -> None:
        assert Txn.sender == self.admin
        assert self.publisher_bps <= UInt64(10_000)
        assert amount.native > UInt64(0)
        assert self.attestation_app_id > UInt64(0)
        assert self.campaign_app_id > UInt64(0)
        assert self.paymaster_app_id > UInt64(0)

        attestation_app = Application(self.attestation_app_id)
        campaign_app = Application(self.campaign_app_id)
        paymaster_app = Application(self.paymaster_app_id)

        # 1) Verify and consume proof on attestation contract.
        consumed, consumed_itxn = arc4.abi_call(
            AttestationContract.validate_and_consume,
            proof_id,
            app_id=attestation_app,
        )
        assert consumed.native == UInt64(1)

        # 2) Deduct one impression from campaign contract.
        deducted_cost, deduct_itxn = arc4.abi_call(
            CampaignContract.deduct_for_impression,
            app_id=campaign_app,
        )
        assert deducted_cost.native > UInt64(0)

        # 3) Split payment using publisher_bps.
        publisher_amount = (amount.native * self.publisher_bps) // UInt64(10_000)
        admin_amount = amount.native - publisher_amount
        itxn.Payment(receiver=publisher.native, amount=publisher_amount).submit()
        itxn.Payment(receiver=self.admin, amount=admin_amount).submit()

        # 4) Fund paymaster and grant sponsorship.
        receive_itxn = arc4.abi_call(
            PaymasterContract.receive_funds,
            amount,
            app_id=paymaster_app,
        )
        sponsorship_itxn = arc4.abi_call(
            PaymasterContract.grant_sponsorship,
            user,
            app_id=paymaster_app,
        )
