(function () {
  "use strict";

  // Product-aware "Discuter" handoff. The minted token is saved by n8n and
  // recognised by the WhatsApp agent, so the conversation opens already bound
  // to the exact catalog product (and variant, when the catalog exposes one).
  var CTX_URL = "https://uncorrectable-jeane-ungrudged.ngrok-free.dev/webhook/dzstorex/wa-context";
  var cfg = window.DZSTORE_CONFIG || {};
  var siteBase = cfg.siteBase || "https://riachsaid.github.io/dzstorex";

  function productUrl(id) {
    return siteBase + "/product.html?id=" + encodeURIComponent(String(id || ""));
  }

  function variantOf(product) {
    if (!product) return "";
    if (product.variantId) return String(product.variantId);
    if (Array.isArray(product.variants) && product.variants.length) {
      var v = product.variants[0];
      return String((v && (v.id || v.variantId)) || "");
    }
    return "";
  }

  async function mint(productId, variant) {
    var qs = new URLSearchParams({
      productId: String(productId),
      source: "website",
      variant: variant || ""
    });
    var controller = typeof AbortController === "function" ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, 8000) : null;
    try {
      var res = await fetch(CTX_URL + "?" + qs.toString(), {
        headers: { "ngrok-skip-browser-warning": "true" },
        signal: controller ? controller.signal : undefined
      });
      if (!res.ok) return null;
      var data = await res.json();
      return data && data.success ? data : null;
    } catch (e) {
      return null;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  function openWhatsApp(message) {
    var href = window.DZStoreWhatsAppUrl
      ? window.DZStoreWhatsAppUrl(message)
      : "https://wa.me/" + String(cfg.whatsappNumber || "15551806504") + "?text=" + encodeURIComponent(message);
    var a = document.createElement("a");
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  async function discuss(product) {
    var id = String(product.id || "");
    var name = String(product.name || "DZStoreX");
    var url = product.url || productUrl(id);
    var variant = variantOf(product);
    if (!id) return;
    var ctx = await mint(id, variant);
    var lines = [
      "مرحبا DZStoreX، نبغي معلومات على المنتج:",
      name,
      url,
      "product:" + id
    ];
    if (ctx && ctx.token) lines.push("token:" + ctx.token);
    if (variant) lines.push("variant:" + variant);
    lines.push("src:website");
    openWhatsApp(lines.join("\n"));
  }

  function button(label) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "dz-discuter";
    b.textContent = label || "Discuter";
    b.setAttribute("aria-label", "Discuter avec DZStoreX à propos de ce produit");
    return b;
  }

  window.DZStoreDiscuter = {
    attachCards: function (products) {
      var grid = document.getElementById("productGrid");
      if (!grid || !Array.isArray(products)) return;
      Array.prototype.forEach.call(grid.querySelectorAll(".product-card"), function (card) {
        if (card.querySelector(".dz-discuter")) return;
        var id = card.getAttribute("data-wa-id") || "";
        var p = products.find(function (x) { return String(x.id) === String(id); }) || {};
        var b = button("💬 Discuter");
        b.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          discuss({ id: id, name: card.getAttribute("data-wa-name") || p.name || "", url: productUrl(id), variant: variantOf(p) });
        });
        var body = card.querySelector(".product-body") || card;
        body.appendChild(b);
      });
    },
    attachProduct: function (product) {
      if (!product || !product.id) return;
      var links = document.querySelector(".product-links");
      if (!links || links.querySelector(".dz-discuter")) return;
      var b = button("💬 Discuter");
      b.addEventListener("click", function (e) {
        e.preventDefault();
        discuss(product);
      });
      links.appendChild(b);
    }
  };
})();
