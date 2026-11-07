# Builds the Instagram post images (1080x1350) from the website photos.
# Run from the repo root with the local site server on :5519, e.g. `python -m http.server 5519`.
import html, os, subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
EDGE = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

POSTS = [
    ("p1-smart-card", None, "card",
     "Smart Business Card", "Un geste.<br>Et il a ton numéro.", "300 DH · paiement unique", "Kteb CARTE 👇"),
    ("p2-assistant", "../../assets/stories/restaurant.jpg", "photo",
     "Smart Assistant 24/7", "23h, un client demande le menu. Qui lui répond ?", "Dès 3 000 DH", "Kteb ASSISTANT 👇"),
    ("p3-website", "../../assets/offers/offer1.jpg", "photo",
     "Professional Website", "Ils te cherchent sur Google.<br>Ils te trouvent ?", "Dès 3 000 DH · 3 mois offerts", "Kteb SITE 👇"),
    ("p4-management", "../../assets/stories/shop.jpg", "photo",
     "Business Management App", "Plus jamais<br>« on n'en a plus ».", "Dès 5 000 DH", "Kteb GESTION 👇"),
    ("p5-salon", "../../assets/stories/salon.jpg", "photo",
     "Smart Assistant 24/7", "Tes clientes réservent seules, même quand tu travailles.", "Dès 3 000 DH", "Kteb RDV 👇"),
    ("p6-reminders", "../../assets/stories/clinic.jpg", "photo",
     "Rappels automatiques", "Plus de rendez-vous<br>oubliés.", "Devis en 1 minute sur le site", "Kteb RAPPEL 👇"),
]

CARD = '<div class="ncard"><div class="chip"></div><div class="nb">NOOR LABS</div><div class="nm">Your Name</div><div class="nr">Your business</div><div class="tap">Tap to connect</div></div>'

TEMPLATE = """<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;700;800&family=Space+Grotesk:wght@700&display=swap" rel="stylesheet">
<style>
*{{margin:0;padding:0;box-sizing:border-box}}
html,body{{width:1080px;height:1350px;overflow:hidden;background:#0f0a1a;font-family:Inter,sans-serif;color:#fff}}
.top{{height:760px;position:relative;overflow:hidden}}
.top img.photo{{width:100%;height:100%;object-fit:cover}}
.top.card{{background:radial-gradient(circle at 50% 40%,#6b21a8,#1e0b3a 70%);display:grid;place-items:center}}
.ncard{{position:relative;width:640px;height:400px;border-radius:36px;padding:44px 48px;transform:rotate(-7deg);background:linear-gradient(135deg,#1e0b3a,#4c1d95 55%,#9333ea);box-shadow:0 50px 90px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.25)}}
.chip{{width:84px;height:62px;border-radius:12px;background:linear-gradient(135deg,#f5d38a,#b8892e)}}
.nb{{position:absolute;top:44px;right:48px;font-family:'Space Grotesk';font-size:30px;letter-spacing:.08em}}
.nm{{margin-top:110px;font-family:'Space Grotesk';font-size:46px}} .nr{{font-size:24px;opacity:.8}}
.tap{{position:absolute;right:44px;bottom:40px;background:rgba(255,255,255,.18);padding:10px 22px;border-radius:999px;font-size:22px}}
.top::after{{content:'';position:absolute;inset:0;background:linear-gradient(180deg,transparent 55%,#0f0a1a)}}
.tag{{position:absolute;top:44px;left:48px;z-index:2;background:linear-gradient(135deg,#9333ea,#d946ef);padding:14px 26px;border-radius:999px;font-weight:700;font-size:28px}}
.bottom{{padding:20px 64px 0}}
h1{{font-family:'Space Grotesk',sans-serif;font-size:70px;line-height:1.08;letter-spacing:-.5px}}
.price{{margin-top:34px;font-size:38px;font-weight:700;color:#e9d5ff}}
.row{{position:absolute;left:64px;right:64px;bottom:60px;display:flex;justify-content:space-between;align-items:center}}
.cta{{background:#fff;color:#2e1065;font-weight:800;font-size:36px;padding:20px 36px;border-radius:999px}}
.brand{{display:flex;align-items:center;gap:16px;font-weight:700;font-size:24px;color:#d8b4fe;letter-spacing:.04em}}
.brand img{{width:64px;height:64px;border-radius:14px}}
</style></head><body>
<div class="top {kind}"><span class="tag">{tag}</span>{visual}</div>
<div class="bottom"><h1>{headline}</h1><div class="price">{price}</div></div>
<div class="row"><span class="cta">{cta}</span><span class="brand"><img src="../../noorlabs.png">noorlabstechnologies.com</span></div>
</body></html>"""

for slug, img, kind, tag, headline, price, cta in POSTS:
    page = os.path.join(HERE, f"_{slug}.html")
    with open(page, "w", encoding="utf-8") as f:
        f.write(TEMPLATE.format(kind=kind, visual=(f'<img class="photo" src="{img}">' if kind == "photo" else CARD),
                                tag=html.escape(tag), headline=headline, price=html.escape(price), cta=cta))
    out = os.path.join(HERE, f"{slug}.png")
    subprocess.run([EDGE, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--virtual-time-budget=6000",
                    "--window-size=1080,1350", f"--screenshot={out}",
                    f"http://localhost:5519/marketing/posts/_{slug}.html"], capture_output=True)
    os.remove(page)
    print("built", slug)
