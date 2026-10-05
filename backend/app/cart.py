"""Cart state machine: the single source of truth for the cart.

States: idle, confirming (the AI is not sure and the customer picks), paying, paid.
"""

import uuid
from dataclasses import dataclass

from .catalog import Catalog, Product

VISION_CONFIDENCE = 0.6
MAX_CANDIDATES = 3


class State:
    IDLE = "idle"
    CONFIRMING = "confirming"
    PAYING = "paying"
    PAID = "paid"


class Mode:
    SCANNER = "scanner"
    VISION = "vision"


def new_id() -> str:
    return uuid.uuid4().hex[:8]


@dataclass
class Line:
    id: str
    product: Product
    quantity: int
    source: str  # "scanner" | "vision" | "selector": how the first unit was added

    @property
    def total(self) -> float:
        return round(self.product.price * self.quantity, 2)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "product": self.product.to_dict(),
            "quantity": self.quantity,
            "total": self.total,
            "source": self.source,
        }


class Cart:
    """Actions that make no sense in the current state are not errors: they leave
    a `notice` for the screen. Unknown ids raise LookupError (404 in the API)."""

    def __init__(self, catalog: Catalog):
        self.catalog = catalog
        self.mode = Mode.SCANNER
        self.notice: dict | None = None
        self.new_cart()

    def new_cart(self) -> None:
        self.state = State.IDLE
        self.lines: list[Line] = []
        self.candidates: list[tuple[Product, float]] = []
        self.receipt_id: str | None = None

    def set_mode(self, mode: str) -> None:
        if mode not in (Mode.SCANNER, Mode.VISION):
            raise LookupError(f"Unknown mode {mode}")
        self.mode = mode

    def scan(self, barcode: str) -> None:
        if self._is_checking_out():
            return
        product = self.catalog.by_barcode(barcode)
        if product is None:
            self.notify(f"Unknown barcode {barcode}")
            return
        self._add(product, "scanner")

    def vision_result(self, candidates: list[tuple[str, float]]) -> None:
        """`candidates` is what the recognizer returns: [(product_id, score)], best first."""
        if self._is_checking_out():
            return
        ranked = [
            (product, score)
            for product_id, score in candidates
            if (product := self.catalog.by_id(product_id)) and not product.sold_by_weight
        ]
        if ranked and ranked[0][1] >= VISION_CONFIDENCE:
            self._add(ranked[0][0], "vision")
            return
        self.candidates = ranked[:MAX_CANDIDATES]
        self.state = State.CONFIRMING
        if not ranked:
            self.notify("Could not recognize the product. Scan it instead.")

    def select(self, product_id: str) -> None:
        product = self.catalog.by_id(product_id)
        if product is None:
            raise LookupError(f"Unknown product {product_id}")
        if self.state != State.CONFIRMING:
            self.notify("Nothing to confirm")
            return
        self._add(product, "selector")

    def cancel(self) -> None:
        """Leaves confirming without adding anything, or the payment screen to keep shopping."""
        if self.state in (State.CONFIRMING, State.PAYING):
            self._back_to_idle()

    def remove(self, line_id: str) -> None:
        line = next((l for l in self.lines if l.id == line_id), None)
        if line is None:
            raise LookupError(f"Unknown line {line_id}")
        if self._is_checking_out():
            return
        line.quantity -= 1
        if line.quantity == 0:
            self.lines.remove(line)
        self.notify(f"Removed {line.product.name}")

    def pay(self) -> None:
        if self.state != State.IDLE or not self.lines:
            self.notify("Add a product before paying")
            return
        self.state = State.PAYING

    def confirm_payment(self) -> None:
        if self.state != State.PAYING:
            self.notify("There is no payment in progress")
            return
        self.receipt_id = new_id().upper()
        self.state = State.PAID

    def _add(self, product: Product, source: str) -> None:
        if product.sold_by_weight:
            self.notify(f"{product.name} is sold by weight: not available in this demo")
            return
        line = next((l for l in self.lines if l.product.id == product.id), None)
        if line is None:
            self.lines.append(Line(new_id(), product, 1, source))
        else:
            line.quantity += 1
        self._back_to_idle()
        self.notify(f"Added {product.name}")

    def _is_checking_out(self) -> bool:
        if self.state in (State.PAYING, State.PAID):
            self.notify("The cart is locked during payment")
            return True
        return False

    def _back_to_idle(self) -> None:
        self.candidates = []
        self.state = State.IDLE

    def notify(self, text: str) -> None:
        self.notice = {"id": new_id(), "text": text}

    def snapshot(self) -> dict:
        return {
            "state": self.state,
            "mode": self.mode,
            "scanner_locked": self.state in (State.PAYING, State.PAID),
            "lines": [l.to_dict() for l in self.lines],
            "total": round(sum(l.total for l in self.lines), 2),
            "candidates": [{"product": p.to_dict(), "score": round(s, 3)} for p, s in self.candidates],
            "notice": self.notice,
            "receipt_id": self.receipt_id,
        }
