from algopy import ARC4Contract, Txn, UInt64, arc4, itxn


class SettlementContract(ARC4Contract):
    def __init__(self) -> None:
        self.admin = Txn.sender
        self.publisher_bps = UInt64(8000)

    @arc4.abimethod
    def settle(self, amount: arc4.UInt64, publisher: arc4.Address) -> None:
        assert Txn.sender == self.admin
        assert self.publisher_bps <= UInt64(10_000)

        publisher_amount = (amount.native * self.publisher_bps) // UInt64(10_000)
        admin_amount = amount.native - publisher_amount

        itxn.Payment(receiver=publisher.native, amount=publisher_amount).submit()
        itxn.Payment(receiver=self.admin, amount=admin_amount).submit()
