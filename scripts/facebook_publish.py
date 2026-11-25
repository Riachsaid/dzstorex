#!/usr/bin/env python3
"""Publish DZStoreX products to the official Facebook Page via Graph API.

Usage:
  DZSTOREX_FB_TOKEN=<page access token> python scripts/facebook_publish.py --dry-run --limit 2
  DZSTOREX_FB_TOKEN=<page access token> python scripts/facebook_publish.py --limit 2

The token is read from the environment only and is never printed or stored.
A local ledger (reports/facebook_posts.json) prevents duplicate publications.
"""
import argparse
import json
import os
import sys
import urllib.parse
import urllib.request
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parent.parent
LEDGER = ROOT / "reports" / "facebook_posts.json"
PRODUCTS_URL = "https://uncorrectable-jeane-ungrudged.ngrok-free.dev/webhook/dzstorex/products"
SITE_BASE = "https://riachsaid.github.io/dzstorex"
DEFAULT_PAGE_ID = "1391319567390331"


def fetch_products():
    req = urllib.request.Request(PRODUCTS_URL, headers={"ngrok-skip-browser-warning": "true"})
    with urllib.request.urlopen(req, timeout=40) as r:
        data = json.loads(r.read().decode("utf-8"))
    return data.get("products", [])


def fmt_price(value):
    if value is None:
        return "السعر غير متوفر / prix indisponible"
    return f"{int(value):,}".replace(",", " ")


def short_desc(text, limit=220):
    clean = " ".join(str(text or "").split())
    if not clean:
        return ""
    return clean[:limit].rstrip() + ("…" if len(clean) > limit else "")


def make_posts(product):
    pid = str(product["id"])
    name = product.get("name") or ""
    price = fmt_price(product.get("priceDa"))
    desc = short_desc(product.get("description"))
    url = f"{SITE_BASE}/product.html?id={urllib.parse.quote(pid)}"
    images = product.get("images") or []
    picture = images[0] if images else ""
    available = product.get("availability") == "available"
    fr_stock = "Disponible à la commande" if available else "Disponibilité non confirmée"
    ar_stock = "متوفر للطلب" if available else "التوفر غير مؤكد"

    fr = f"🔥 {name}\n\n💰 {price} DA — prix client final\n{fr_stock}\n{desc}\n\n👉 {url}\n#DZStoreX #Algérie"
    ar = f"🔥 {name}\n\n💰 السعر النهائي للزبون: {price} دج\n{ar_stock}\n{desc}\n\n👉 {url}\n#DZStoreX #الجزائر"
    return [
        {"key": f"{pid}:fr", "productId": pid, "language": "fr", "message": fr, "link": url, "picture": picture},
        {"key": f"{pid}:ar", "productId": pid, "language": "ar", "message": ar, "link": url, "picture": picture},
    ]


def load_ledger():
    if LEDGER.exists():
        try:
            return json.loads(LEDGER.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {"posts": [], "updatedAt": None}


def save_ledger(ledger):
    LEDGER.parent.mkdir(parents=True, exist_ok=True)
    ledger["updatedAt"] = datetime.now(timezone.utc).isoformat()
    LEDGER.write_text(json.dumps(ledger, ensure_ascii=False, indent=2), encoding="utf-8")


def publish(token, page_id, post):
    payload = {
        "message": post["message"],
        "link": post["link"],
        "access_token": token,
    }
    # Facebook only honours a manual `picture` for URLs owned by the page,
    # so previews come from the product page's Open Graph tags instead.
    body = urllib.parse.urlencode(payload).encode("utf-8")
    req = urllib.request.Request(
        f"https://graph.facebook.com/v21.0/{page_id}/feed",
        data=body,
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        return {"error": body, "httpStatus": e.code}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--limit", type=int, default=0, help="max number of products (0 = all)")
    ap.add_argument("--page-id", default=os.environ.get("DZSTOREX_FB_PAGE_ID", DEFAULT_PAGE_ID))
    args = ap.parse_args()

    token = os.environ.get("DZSTOREX_FB_TOKEN", "")
    if not args.dry_run and not token:
        print("DZSTOREX_FB_TOKEN is required", file=sys.stderr)
        return 2

    products = fetch_products()
    if args.limit:
        products = products[: args.limit]
    ledger = load_ledger()
    done = {p["key"] for p in ledger["posts"]}
    published = 0
    skipped = 0

    for product in products:
        for post in make_posts(product):
            if post["key"] in done:
                skipped += 1
                continue
            if args.dry_run:
                print(f"[DRY] {post['key']} :: {post['message'][:160]!r} picture={post['picture']}")
                continue
            result = publish(token, args.page_id, post)
            if "id" not in result:
                ledger.setdefault("failures", []).append({
                    "key": post["key"],
                    "error": result,
                    "attemptedAt": datetime.now(timezone.utc).isoformat(),
                })
                save_ledger(ledger)
                print(f"[FAIL] {post['key']} :: {result}", file=sys.stderr)
                continue
            post_id = result["id"]
            entry = dict(post)
            entry.update({
                "postId": post_id,
                "url": f"https://www.facebook.com/{args.page_id}/posts/{post_id}",
                "publishedAt": datetime.now(timezone.utc).isoformat(),
            })
            ledger["posts"].append(entry)
            save_ledger(ledger)
            published += 1
            print(f"[OK] {post['key']} :: {entry['url']}")

    print(json.dumps({"products": len(products), "published": published, "skippedDuplicates": skipped, "dryRun": args.dry_run}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
