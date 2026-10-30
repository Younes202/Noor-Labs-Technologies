# Smart NFC card — print files

| File | Use |
|---|---|
| `noor-nfc-card-print.pdf` | Send this to the print shop (page 1 = front, page 2 = back) |
| `noor-nfc-card-front.png`, `noor-nfc-card-back.png` | Same design as 300 DPI images (for sticker printing or preview) |
| `card-print.html` | The editable design |

**Print specs:** card 85.6 × 54 mm (CR80, bank-card size), files are 91.6 × 60 mm = 3 mm bleed on each side, 300 DPI, rounded corners 3.2 mm. Text stays inside a 3 mm safe margin.

**NFC chip:** write `https://noorlabstechnologies.com/card/` (or the client's own `/card/<name>/` link) with the free *NFC Tools* app → Write → Add a record → URL. The QR code on the back opens the same link.

## Personalised card for a client

1. Edit the `CARD` block at the top of the `<script>` in `card-print.html` (name, role, profile URL, contacts).
2. Start the local preview server (`python -m http.server 5519` in the project folder) and export:

```
chrome --headless=new --no-pdf-header-footer --virtual-time-budget=8000 --print-to-pdf=card.pdf http://localhost:5519/marketing/nfc-card/card-print.html
chrome --headless=new --hide-scrollbars --virtual-time-budget=8000 --window-size=346,227 --force-device-scale-factor=3.125 --screenshot=front.png "http://localhost:5519/marketing/nfc-card/card-print.html?side=front"
chrome --headless=new --hide-scrollbars --virtual-time-budget=8000 --window-size=346,227 --force-device-scale-factor=3.125 --screenshot=back.png "http://localhost:5519/marketing/nfc-card/card-print.html?side=back"
```
