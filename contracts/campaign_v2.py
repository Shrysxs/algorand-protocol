from algopy import ARC4Contract, Txn, UInt64, arc4


class CampaignV2Contract(ARC4Contract):
    def __init__(self) -> None:
        self.advertiser = Txn.sender
        self.budget = UInt64(0)
        self.cost_per_impression = UInt64(1)

    @arc4.abimethod
    def deposit_budget(self, amount: arc4.UInt64) -> None:
        assert Txn.sender == self.advertiser
        self.budget = self.budget + amount.native

    @arc4.abimethod
    def deduct(self) -> arc4.UInt64:
        assert Txn.sender == self.advertiser
        assert self.budget >= self.cost_per_impression
        self.budget = self.budget - self.cost_per_impression
        return arc4.UInt64(self.cost_per_impression)

    @arc4.abimethod
    def deduct_for_impression(self) -> arc4.UInt64:
        assert self.budget >= self.cost_per_impression
        self.budget = self.budget - self.cost_per_impression
        return arc4.UInt64(self.cost_per_impression)

    @arc4.abimethod
    def get_budget(self) -> arc4.UInt64:
        return arc4.UInt64(self.budget)
