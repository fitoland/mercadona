"""Product catalog loaded from data/catalog.json."""

import json
from dataclasses import asdict, dataclass
from pathlib import Path

DEFAULT_PATH = Path(__file__).parent / "data" / "catalog.json"


@dataclass(frozen=True)
class Product:
    id: str
    barcode: str
    name: str
    price: float  # per unit, or per kg when sold by weight
    unit: str  # "unit" | "kg"
    # Expected weight for packaged products; for weighed products it is only a
    # typical bag weight the simulator uses.
    weight_g: float
    vision_label: str
    emoji: str

    @property
    def sold_by_weight(self) -> bool:
        return self.unit == "kg"

    def to_dict(self) -> dict:
        return asdict(self)


class Catalog:
    def __init__(self, products: list[Product]):
        self.products = products
        self._by_id = {p.id: p for p in products}
        self._by_barcode = {p.barcode: p for p in products}

    @classmethod
    def load(cls, path: Path = DEFAULT_PATH) -> "Catalog":
        data = json.loads(path.read_text(encoding="utf-8"))
        return cls([Product(**p) for p in data["products"]])

    def by_id(self, product_id: str) -> Product | None:
        return self._by_id.get(product_id)

    def by_barcode(self, barcode: str) -> Product | None:
        return self._by_barcode.get(barcode.strip())
