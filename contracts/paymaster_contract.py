from algopy import ARC4Contract, Txn, UInt64, arc4, itxn


class PaymasterContract(ARC4Contract):
    def __init__(self) -> None:
        self.admin = Txn.sender
        self.balance = UInt64(0)

    @arc4.abimethod
    def fund(self, amount: arc4.UInt64) -> None:
        assert Txn.sender == self.admin
        self.balance = self.balance + amount.native

    @arc4.abimethod
    def sponsor(self, user: arc4.Address, amount: arc4.UInt64) -> None:
        assert Txn.sender == self.admin
        assert self.balance >= amount.native

        self.balance = self.balance - amount.native
        itxn.Payment(receiver=user.native, amount=amount.native).submit()
