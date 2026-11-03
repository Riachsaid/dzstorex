(function () {
  "use strict";

  const cfg = window.DZSTORE_CONFIG;

  // ngrok serves a browser warning page unless this header is present.
  // It is a public tunnel flag only, never a secret.
  const baseHeaders = { "ngrok-skip-browser-warning": "true" };

  async function request(path, options) {
    const opts = options || {};
    opts.headers = Object.assign({}, baseHeaders, opts.headers || {});
    const res = await fetch(cfg.apiBase + path, opts);
    let data = null;
    try {
      data = await res.json();
    } catch (e) {
      data = null;
    }

    if (!res.ok) {
      const error = new Error((data && data.message) || "HTTP " + res.status);
      error.status = res.status;
      error.data = data;
      throw error;
    }

    return data;
  }

  window.DZStoreAPI = {
    getProducts: function () {
      return request("/dzstorex/products");
    },
    getProduct: function (id) {
      return request("/dzstorex/products?id=" + encodeURIComponent(id));
    },
    submitOrder: function (payload) {
      return request("/dzstorex/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    }
  };
})();
