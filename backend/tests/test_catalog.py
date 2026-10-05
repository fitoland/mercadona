from app.catalog import Catalog, Product

WATER = Product("water", "2000000000053", "Water 0.5 L", 0.45, "unit", 520, "a bottle of water", "💧", yolo_label="bottle")
COOKIES = Product("cookies", "2000000000077", "Cookies", 2.00, "unit", 160, "a bag of cookies", "🍪")


def test_a_yolo_label_maps_to_its_real_product():
    catalog = Catalog([WATER, COOKIES])

    assert catalog.by_yolo_label("bottle") == WATER


def test_unmapped_yolo_labels_have_no_product():
    catalog = Catalog([WATER, COOKIES])

    assert catalog.by_yolo_label("cake") is None


def test_demo_catalog_maps_water_and_banana():
    catalog = Catalog.load()

    assert catalog.by_yolo_label("bottle").id == "agua-cabreiroa-05"
    banana = catalog.by_yolo_label("banana")
    assert banana.sold_by_weight
    assert banana.weight_g > 0
