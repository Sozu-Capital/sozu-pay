# Named Standing Checkout URLs

Merchants need a URL they can print, WhatsApp, and keep — store name and checkout name in the path, still valid after each sale, turn-offable, optionally born with a deadline. If that URL is off or past deadline it must land on the store's public page, so the name on the internet still belongs to them.

We use `https://pay.sozu.capital/{store-slug}/{checkout-slug}` as the public address of a **Standing checkout**. The store slug is the **Org Sozu tag** when present, otherwise a unique slug from the org display name. Completing a payment records a sale against the standing offer; it does not mint a new URL and does not complete-away the offer.

**POS checkouts** stay on opaque `/checkout/{id}` with short TTL. Mixing those into named durable URLs would make every till QR a permanent public price, which is the wrong product.

Considered and rejected: keep only `cs_*` ids (no ownership of the name); one-shot named URLs that die after payment (breaks “same link after each sale”); 404 on inactive named URLs (abandons the name).
