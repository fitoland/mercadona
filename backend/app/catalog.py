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
    # COCO class YOLO reports for this product; the pretrained model can't tell brands apart.
    yolo_label: str | None = None

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
        self._by_yolo_label = {p.yolo_label: p for p in products if p.yolo_label}

    @classmethod
    def load(cls, path: Path = DEFAULT_PATH) -> "Catalog":
        data = json.loads(path.read_text(encoding="utf-8"))
        products = [Product(**p) for p in data["products"]]
        if path == DEFAULT_PATH:
            demo = json.loads((DEFAULT_PATH.parent / "yolo_catalog.json").read_text(encoding="utf-8"))
            products.extend(Product(**p) for p in demo["products"])
        return cls(products)

    def by_id(self, product_id: str) -> Product | None:
        return self._by_id.get(product_id)

    def by_barcode(self, barcode: str) -> Product | None:
        return self._by_barcode.get(barcode.strip())

    def by_yolo_label(self, label: str) -> Product | None:
        return self._by_yolo_label.get(label)
