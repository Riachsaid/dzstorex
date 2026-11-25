#!/usr/bin/env python3
"""Export publication/listing/failure facts for the static sales dashboard."""
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REPORTS = ROOT / "reports"
OUT = ROOT / "assets" / "data" / "sales-factory.json"


def load(name, default):
    p = REPORTS / name
    if p.exists():
        try:
            return json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            return default
    return default


def main():
    fb = load("facebook_posts.json", {"posts": [], "failures": []})
    mp = load("marketplace_listings.json", {"listings": []})
    posts = fb.get("posts", [])
    listings = mp.get("listings", [])
    data = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "facebook": {
            "publishedPosts": len(posts),
            "byLanguage": {
                "fr": sum(1 for p in posts if p.get("language") == "fr"),
                "ar": sum(1 for p in posts if p.get("language") == "ar"),
            },
            "posts": [{k: p.get(k) for k in ("productId", "language", "postId", "url", "publishedAt")} for p in posts],
            "failures": fb.get("failures", []),
        },
        "marketplace": {
            "apiPublishingAvailable": mp.get("apiPublishingAvailable", False),
            "prepared": sum(1 for l in listings if l.get("status") == "prepared"),
            "alreadyListed": sum(1 for l in listings if l.get("status") == "listed"),
            "listings": [{k: l.get(k) for k in ("productId", "name", "priceDa", "status", "listingUrl", "productUrl")} for l in listings],
        },
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"out": str(OUT), "posts": len(posts), "listings": len(listings), "failures": len(fb.get("failures", []))}, ensure_ascii=False))


if __name__ == "__main__":
    main()
