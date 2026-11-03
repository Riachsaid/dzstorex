(function () {
  "use strict";

  const params = new URLSearchParams(window.location.search);
  const productId = String(params.get("id") || "").trim();

  const loadingEl = document.getElementById("productLoading");
  const errorEl = document.getElementById("productError");
  const contentEl = document.getElementById("productContent");
  const galleryMain = document.getElementById("galleryMain");
  const thumbsEl = document.getElementById("galleryThumbs");
  const titleEl = document.getElementById("productTitle");
  const priceEl = document.getElementById("productPrice");
  const availabilityEl = document.getElementById("productAvailability");
  const descriptionEl = document.getElementById("productDescription");
  const ctaBtn = document.getElementById("orderNowBtn");
  const orderSection = document.getElementById("orderSection");
  const summaryEl = document.getElementById("productOrderSummary");
  const quantityEl = document.getElementById("productQuantity");
  const orderForm = document.getElementById("orderForm");
  let currentProduct = null;

  function formatDa(value) {
    return window.DZStoreFormatDa ? window.DZStoreFormatDa(value) : String(value) + " دج";
  }

  function escapeHtml(value) {
    return window.DZStoreEscapeHtml ? window.DZStoreEscapeHtml(value) : String(value);
  }

  function formatDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    try {
      return date.toLocaleDateString("ar-DZ", { year: "numeric", month: "long", day: "numeric" });
    } catch (e) {
      return date.toISOString().slice(0, 10);
    }
  }

  function showError(message) {
    if (loadingEl) loadingEl.classList.add("hidden");
    if (contentEl) contentEl.classList.add("hidden");
    if (errorEl) {
      errorEl.classList.remove("hidden");
      errorEl.innerHTML = '<div class="empty-state">' + escapeHtml(message) + '<br><a href="index.html">العودة إلى الصفحة الرئيسية</a></div>';
    }
  }

  function renderGallery(images) {
    if (!galleryMain || !thumbsEl) return;
    const list = images && images.length ? images : ["assets/img/placeholder.svg"];

    galleryMain.innerHTML = '<img id="mainImage" src="' + escapeHtml(list[0]) + '" alt="' + escapeHtml(currentProduct.name) + '">';
    thumbsEl.innerHTML = list
      .map(function (src, index) {
        return (
          '<button type="button" class="' + (index === 0 ? "active" : "") + '" data-index="' + index + '" aria-label="صورة ' + (index + 1) + '">' +
            '<img src="' + escapeHtml(src) + '" alt="" loading="lazy">' +
          "</button>"
        );
      })
      .join("");

    const mainImage = document.getElementById("mainImage");
    if (mainImage) {
      mainImage.onerror = function () {
        mainImage.src = "assets/img/placeholder.svg";
      };
    }

    thumbsEl.querySelectorAll("button").forEach(function (button) {
      button.addEventListener("click", function () {
        const index = Number(button.dataset.index || 0);
        if (mainImage) mainImage.src = list[index];
        thumbsEl.querySelectorAll("button").forEach(function (b) {
          b.classList.remove("active");
        });
        button.classList.add("active");
      });
    });
  }

  function updateSummary() {
    if (!summaryEl || !currentProduct) return;
    const qty = Math.max(1, Math.min(10, Number(quantityEl && quantityEl.value) || 1));
    const total = Number(currentProduct.priceDa) * qty;
    summaryEl.innerHTML =
      "<span>سعر الوحدة: <strong>" + formatDa(currentProduct.priceDa) + "</strong></span>" +
      "<span>المجموع: <strong>" + formatDa(total) + "</strong> (دون التوصيل)</span>";
  }

  function renderProduct(product) {
    currentProduct = product;
    document.title = product.name + " | DZStoreX";

    if (titleEl) titleEl.textContent = product.name;
    if (priceEl) priceEl.textContent = product.priceDa === null ? "السعر غير متوفر" : formatDa(product.priceDa);
    if (descriptionEl) {
      descriptionEl.textContent = product.description && product.description.trim()
        ? product.description
        : "الوصف التفصيلي غير متوفر حالياً. يمكنك سؤال المساعد أو التواصل مع الفريق.";
    }

    if (availabilityEl) {
      if (product.orderable) {
        const verified = formatDate(product.stockVerifiedAt);
        availabilityEl.className = "availability-note available";
        availabilityEl.innerHTML =
          '<span class="badge badge-available">متوفر للطلب</span> ' +
          (verified ? "تم التحقق من التوفر بتاريخ " + escapeHtml(verified) + "." : "التوفر مؤكد من المتجر.");
      } else {
        availabilityEl.className = "availability-note unverified";
        availabilityEl.innerHTML =
          '<span class="badge badge-unverified">التوفر غير مؤكد</span> ' +
          "الطلب غير متاح حالياً لهذا المنتج. يمكنك سؤال المساعد أو التواصل مع الفريق.";
      }
    }

    renderGallery(product.images);

    if (ctaBtn) {
      if (product.orderable) {
        ctaBtn.disabled = false;
        ctaBtn.textContent = "اطلب الآن";
        ctaBtn.addEventListener("click", function () {
          if (orderSection) orderSection.scrollIntoView({ behavior: "smooth", block: "start" });
          const nameInput = orderForm && orderForm.querySelector('input[name="fullName"]');
          if (nameInput) setTimeout(function () { nameInput.focus(); }, 350);
        });
      } else {
        ctaBtn.disabled = true;
        ctaBtn.textContent = "غير متاح للطلب حالياً";
        if (orderSection) orderSection.classList.add("hidden");
      }
    }

    if (window.DZStoreChat) {
      window.DZStoreChat.setProduct(product.id);
      window.DZStoreChat.setOrderContext(null);
    }

    if (loadingEl) loadingEl.classList.add("hidden");
    if (contentEl) contentEl.classList.remove("hidden");
    updateSummary();
  }

  async function load() {
    if (!productId) {
      showError("لم يتم تحديد المنتج. اختر منتجاً من الصفحة الرئيسية.");
      return;
    }

    if (!/^\d{3,10}$/.test(productId)) {
      showError("رقم المنتج غير صحيح.");
      return;
    }

    try {
      const data = await window.DZStoreAPI.getProduct(productId);
      if (!data || !data.success || !data.product) {
        showError("المنتج غير موجود.");
        return;
      }
      renderProduct(data.product);
    } catch (error) {
      console.error(error);
      if (error.status === 404) showError("المنتج غير موجود.");
      else showError("تعذر تحميل المنتج حالياً. تحقق من اتصالك ثم أعد تحميل الصفحة.");
    }
  }

  if (quantityEl) quantityEl.addEventListener("input", updateSummary);

  window.initDZOrderForm({
    formId: "orderForm",
    messageId: "formMessage",
    resultId: "orderResult",
    source: "product",
    getProductId: function () {
      return productId;
    },
    onSuccess: function () {
      updateSummary();
    }
  });

  load();
})();
