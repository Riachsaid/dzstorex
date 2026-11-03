(function () {
  "use strict";

  const gridEl = document.getElementById("productGrid");
  const loadingEl = document.getElementById("productsLoading");
  const errorEl = document.getElementById("productsError");
  const selectEl = document.getElementById("productSelect");
  const quantityEl = document.getElementById("quantity");
  const summaryEl = document.getElementById("homeOrderSummary");
  let products = [];

  function formatDa(value) {
    return window.DZStoreFormatDa ? window.DZStoreFormatDa(value) : String(value) + " دج";
  }

  function escapeHtml(value) {
    return window.DZStoreEscapeHtml ? window.DZStoreEscapeHtml(value) : String(value);
  }

  function availabilityLabel(product) {
    return product.orderable ? "متوفر للطلب" : "التوفر غير مؤكد";
  }

  function renderProducts() {
    if (!gridEl) return;
    if (!products.length) {
      gridEl.innerHTML = '<div class="empty-state">لا توجد منتجات منشورة حالياً.</div>';
      return;
    }

    gridEl.innerHTML = products
      .slice()
      .sort(function (a, b) {
        if (a.orderable === b.orderable) return String(a.name).localeCompare(String(b.name), "ar");
        return a.orderable ? -1 : 1;
      })
      .map(function (p) {
        const image = p.images && p.images.length ? p.images[0] : "assets/img/placeholder.svg";
        return (
          '<a class="product-card" href="product.html?id=' + encodeURIComponent(p.id) + '">' +
            '<div class="product-thumb"><img src="' + escapeHtml(image) + '" alt="' + escapeHtml(p.name) + '" loading="lazy" onerror="this.src=\'assets/img/placeholder.svg\'"></div>' +
            '<div class="product-body">' +
              "<h3>" + escapeHtml(p.name) + "</h3>" +
              '<div class="product-meta">' +
                '<div class="price-line"><span class="price">' + (p.priceDa === null ? "غير متوفر" : formatDa(p.priceDa)) + "</span></div>" +
                '<div class="status-line"><span class="badge ' + (p.orderable ? "badge-available" : "badge-unverified") + '">' + availabilityLabel(p) + "</span></div>" +
              "</div>" +
            "</div>" +
          "</a>"
        );
      })
      .join("");
  }

  function populateSelect() {
    if (!selectEl) return;
    const options = ['<option value="">اختر المنتج</option>'];
    products.forEach(function (p) {
      const label = p.name + " — " + (p.priceDa === null ? "السعر غير متوفر" : formatDa(p.priceDa));
      options.push(
        '<option value="' + escapeHtml(p.id) + '"' + (p.orderable ? "" : " disabled") + ">" +
          escapeHtml(label) + (p.orderable ? "" : " (غير متاح للطلب)") +
        "</option>"
      );
    });
    selectEl.innerHTML = options.join("");
  }

  function updateSummary() {
    if (!summaryEl || !selectEl) return;
    const selected = products.find(function (p) {
      return String(p.id) === String(selectEl.value);
    });
    if (!selected) {
      summaryEl.textContent = "اختر منتجاً لعرض السعر النهائي.";
      return;
    }
    if (!selected.orderable) {
      summaryEl.textContent = "هذا المنتج غير متاح للطلب حالياً لأن التوفر غير مؤكد.";
      return;
    }
    const qty = Math.max(1, Math.min(10, Number(quantityEl && quantityEl.value) || 1));
    const total = Number(selected.priceDa) * qty;
    summaryEl.innerHTML =
      '<span class="summary-line">سعر الوحدة: <span class="price-inline">' + formatDa(selected.priceDa) + "</span></span>" +
      '<span class="summary-line">المجموع: <span class="price-inline">' + formatDa(total) + "</span> (دون التوصيل)</span>";
  }

  async function load() {
    if (loadingEl) loadingEl.classList.remove("hidden");
    if (errorEl) errorEl.classList.add("hidden");

    try {
      const data = await window.DZStoreAPI.getProducts();
      products = (data && data.products) || [];
      renderProducts();
      populateSelect();
      updateSummary();
      if (loadingEl) loadingEl.classList.add("hidden");
    } catch (error) {
      console.error(error);
      if (loadingEl) loadingEl.classList.add("hidden");
      if (errorEl) {
        errorEl.classList.remove("hidden");
        errorEl.textContent = "تعذر تحميل المنتجات حالياً. تحقق من اتصالك ثم أعد تحميل الصفحة.";
      }
    }
  }

  if (selectEl) selectEl.addEventListener("change", updateSummary);
  if (quantityEl) quantityEl.addEventListener("input", updateSummary);

  window.initDZOrderForm({
    formId: "orderForm",
    messageId: "formMessage",
    resultId: "orderResult",
    source: "homepage",
    getProductId: function () {
      return selectEl ? selectEl.value : "";
    }
  });

  load();
})();
