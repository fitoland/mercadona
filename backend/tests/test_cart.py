import pytest

from app.cart import Cart, Mode, State
from app.catalog import Catalog

catalog = Catalog.load()
MILK = catalog.by_id("leche-entera")
WATER = catalog.by_id("agua")
YOGURT = catalog.by_id("yogur-natural")
BANANA = catalog.by_id("platano")


@pytest.fixture
def cart():
    return Cart(catalog)


def products(cart):
    return [(l.product.id, l.quantity) for l in cart.lines]


def test_scanning_adds_a_line(cart):
    cart.scan(MILK.barcode)

    assert products(cart) == [(MILK.id, 1)]
    assert cart.lines[0].source == "scanner"


def test_scanning_the_same_product_again_adds_a_unit(cart):
    cart.scan(MILK.barcode)
    cart.scan(MILK.barcode)

    assert products(cart) == [(MILK.id, 2)]
    assert cart.snapshot()["total"] == round(MILK.price * 2, 2)


def test_unknown_barcode_leaves_a_notice(cart):
    cart.scan("0000000000000")

    assert cart.lines == []
    assert "Unknown barcode" in cart.notice["text"]


def test_products_sold_by_weight_are_not_added(cart):
    cart.scan(BANANA.barcode)

    assert cart.lines == []


def test_removing_takes_one_unit_and_then_the_line(cart):
    cart.scan(MILK.barcode)
    cart.scan(MILK.barcode)
    line_id = cart.lines[0].id

    cart.remove(line_id)
    assert products(cart) == [(MILK.id, 1)]

    cart.remove(line_id)
    assert cart.lines == []


def test_removing_an_unknown_line_raises(cart):
    with pytest.raises(LookupError):
        cart.remove("nope")


def test_confident_vision_result_adds_the_product(cart):
    cart.vision_result([(WATER.id, 0.9), (MILK.id, 0.1)])

    assert products(cart) == [(WATER.id, 1)]
    assert cart.lines[0].source == "vision"
    assert cart.state == State.IDLE


def test_unsure_vision_result_asks_the_customer(cart):
    cart.vision_result([(MILK.id, 0.4), (YOGURT.id, 0.3), (WATER.id, 0.2), ("arroz", 0.1)])

    assert cart.state == State.CONFIRMING
    assert [p.id for p, _ in cart.candidates] == [MILK.id, YOGURT.id, WATER.id]


def test_vision_ignores_products_sold_by_weight(cart):
    cart.vision_result([(BANANA.id, 0.9), (MILK.id, 0.1)])

    assert cart.state == State.CONFIRMING
    assert [p.id for p, _ in cart.candidates] == [MILK.id]


def test_choosing_a_candidate_adds_it(cart):
    cart.vision_result([(MILK.id, 0.4), (YOGURT.id, 0.3)])
    cart.select(YOGURT.id)

    assert products(cart) == [(YOGURT.id, 1)]
    assert cart.lines[0].source == "selector"
    assert cart.state == State.IDLE
    assert cart.candidates == []


def test_scanning_while_confirming_resolves_it(cart):
    cart.vision_result([(MILK.id, 0.4)])
    cart.scan(WATER.barcode)

    assert products(cart) == [(WATER.id, 1)]
    assert cart.state == State.IDLE


def test_cancel_leaves_confirming_without_adding(cart):
    cart.vision_result([(MILK.id, 0.4)])
    cart.cancel()

    assert cart.state == State.IDLE
    assert cart.lines == []


def test_select_outside_confirming_does_nothing(cart):
    cart.select(MILK.id)

    assert cart.lines == []


def test_cannot_pay_an_empty_cart(cart):
    cart.pay()

    assert cart.state == State.IDLE


def test_payment_flow(cart):
    cart.scan(MILK.barcode)
    cart.pay()
    assert cart.state == State.PAYING

    cart.confirm_payment()
    assert cart.state == State.PAID
    assert cart.receipt_id

    cart.new_cart()
    assert cart.state == State.IDLE
    assert cart.lines == []


def test_cart_is_locked_during_payment(cart):
    cart.scan(MILK.barcode)
    cart.pay()

    cart.scan(WATER.barcode)
    cart.vision_result([(WATER.id, 0.9)])
    cart.remove(cart.lines[0].id)

    assert products(cart) == [(MILK.id, 1)]
    assert cart.snapshot()["scanner_locked"] is True


def test_mode_can_be_switched(cart):
    cart.set_mode(Mode.VISION)

    assert cart.snapshot()["mode"] == Mode.VISION
    with pytest.raises(LookupError):
        cart.set_mode("teleport")
