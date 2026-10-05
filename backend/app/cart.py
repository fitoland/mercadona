"""Cart state machine: the single source of truth for the cart.

The scale says *when* something enters or leaves the cart and *how much* it
weighs; the scanner, the fruit selector or the camera say *what* it is.
States: idle, waiting_item, measuring, recognizing, confirming, alert, paying, paid.
"""
