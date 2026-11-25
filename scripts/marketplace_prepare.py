#!/usr/bin/env python3
"""Generate manual-publication-ready Facebook Marketplace listings from the live catalog.

Facebook does not expose a supported Graph API for creating Marketplace listings
for this account (GET /{page}/marketplace_listings returns error 2500). This script
prepares complete listings (bilingual text, verified price, images, product URL)
and tracks status in a local ledger so nothing is published twice.
"""
import csv
import json
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REPORTS = ROOT / "reports"
PRODUCTS_URL = "https://uncorrectable-jeane-ungrudged.ngrok-free.dev/webhook/dzstorex/products"
SITE_BASE = "https://riachsaid.github.io/dzstorex"
LEDGER = REPORTS / "marketplace_listings.json"


def fetch_products():
    req = urllib.request.Request(PRODUCTS_URL, headers={"ngrok-skip-browser-warning": "true"})
    with urllib.request.urlopen(req, timeout=40) as r:
        return json.loads(r.read().decode("utf-8")).get("products", [])


def fmt(v):
    if v is None:
        return "Prix non disponible / السعر غير متوفر"
    return f"{int(v):,}".replace(",", " ")


def desc(text, limit=420):
    clean = " ".join(str(text or "").split())
    return clean[:limit].rstrip() + ("…" if len(clean) > limit else "")


def main():
    products = fetch_products()
    prior = {}
    if LEDGER.exists():
        try:
            prior = {x["productId"]: x for x in json.loads(LEDGER.read_text(encoding="utf-8")).get("listings", [])}
        except Exception:
            prior = {}
    REPORTS.mkdir(parents=True, exist_ok=True)
    rows = []
    for p in products:
        pid = str(p["id"])
        url = f"{SITE_BASE}/product.html?id={urllib.parse.quote(pid)}"
        images = p.get("images") or []
        available = p.get("availability") == "available"
        fr = (
            f"{p.get('name','')}\n\n"
            f"Prix client final : {fmt(p.get('priceDa'))} DA\n"
            f"{'Disponible à la commande' if available else 'Disponibilité non confirmée — ne pas annoncer comme disponible'}\n\n"
            f"{desc(p.get('description'))}\n\n"
            f"Fiche produit et commande : {url}\n"
            f"Livraison : Yalidine, ZR Express (confirmation téléphonique)."
        )
        ar = (
            f"{p.get('name','')}\n\n"
            f"السعر النهائي للزبون: {fmt(p.get('priceDa'))} دج\n"
            f"{'متوفر للطلب' if available else 'التوفر غير مؤكد — لا تعلن عنه كمتوفر'}\n\n"
            f"{desc(p.get('description'))}\n\n"
            f"صفحة المنتج والطلب: {url}\n"
            f"التوصيل: ياليدين، زر إكسبريس (تأكيد هاتفي)."
        )
        existing = prior.get(pid, {})
        rows.append({
            "productId": pid,
            "name": p.get("name", ""),
            "priceDa": p.get("priceDa"),
            "availability": p.get("availability"),
            "alreadyListedUrl": p.get("marketplaceUrl") or existing.get("listingUrl") or "",
            "status": "listed" if (p.get("marketplaceUrl") or existing.get("listingUrl")) else "prepared",
            "image1": images[0] if images else "",
            "image2": images[1] if len(images) > 1 else "",
            "image3": images[2] if len(images) > 2 else "",
            "productUrl": url,
            "descriptionFr": fr,
            "descriptionAr": ar,
        })

    csv_path = REPORTS / "marketplace_listings.csv"
    with csv_path.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)

    md = ["# DZStoreX — Facebook Marketplace listing pack", "",
          f"Generated {datetime.now(timezone.utc).isoformat()} from the live catalog ({len(rows)} products).",
          "Direct API publishing is **not available** for this account (Graph error 2500 on `/marketplace_listings`).",
          "These listings are ready for manual publication; prices and availability come from the authoritative backend.",
          "", "| ID | Product | Price (DA) | Status | Image |", "|---|---|---:|---|---|"]
    for r in rows:
        md.append(f"| {r['productId']} | {r['name'][:70]} | {r['priceDa']} | {r['status']} | {r['image1']} |")
    md += ["", "## French listing text", ""]
    for r in rows:
        md += [f"### {r['productId']} — {r['name']}", "", "```", r["descriptionFr"], "```", ""]
    md += ["## Arabic / Darija listing text", ""]
    for r in rows:
        md += [f"### {r['productId']} — {r['name']}", "", "```", r["descriptionAr"], "```", ""]
    (REPORTS / "marketplace_listings.md").write_text("\n".join(md), encoding="utf-8")

    ledger = {
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "apiPublishingAvailable": False,
        "apiEvidence": "Graph GET /1391319567390331/marketplace_listings -> OAuthException 2500 Unknown path components",
        "listings": rows,
    }
    LEDGER.write_text(json.dumps(ledger, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"products": len(rows), "prepared": sum(1 for r in rows if r["status"] == "prepared"),
                      "alreadyListed": sum(1 for r in rows if r["status"] == "listed"),
                      "csv": str(csv_path), "ledger": str(LEDGER)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
