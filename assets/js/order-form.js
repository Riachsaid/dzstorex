(function () {
  "use strict";

  const fieldLabels = {
    fullName: "الاسم الكامل",
    phone: "رقم الهاتف",
    wilayaCode: "الولاية",
    commune: "البلدية",
    address: "العنوان",
    quantity: "الكمية",
    deliveryCompany: "شركة التوصيل",
    notes: "الملاحظات",
    productId: "المنتج"
  };

  function normalizePhone(value) {
    let phone = String(value || "").replace(/[\s\-().]/g, "");
    if (phone.indexOf("+213") === 0) phone = "0" + phone.slice(4);
    else if (phone.indexOf("00213") === 0) phone = "0" + phone.slice(5);
    return phone;
  }

  function populateWilayas(select) {
    if (!select || select.options.length > 1) return;
    const wilayas = window.DZ_WILAYAS || [];
    wilayas.forEach(function (w) {
      const option = document.createElement("option");
      option.value = w.code;
      option.textContent = w.code + " - " + w.name;
      select.appendChild(option);
    });
  }

  window.initDZOrderForm = function (options) {
    options = options || {};
    const form = document.getElementById(options.formId || "orderForm");
    if (!form) return null;

    const messageEl = document.getElementById(options.messageId || "formMessage");
    const resultEl = document.getElementById(options.resultId || "orderResult");
    const submitBtn = form.querySelector('button[type="submit"]');
    const wilayaSelect = form.querySelector('select[name="wilayaCode"]');
    populateWilayas(wilayaSelect);

    function showMessage(text, type) {
      if (!messageEl) return;
      messageEl.textContent = text;
      messageEl.className = "form-message show" + (type === "success" ? " success" : "");
      messageEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    function clearErrors() {
      form.querySelectorAll(".invalid").forEach(function (el) {
        el.classList.remove("invalid");
      });
      if (messageEl) {
        messageEl.className = "form-message";
        messageEl.textContent = "";
      }
      if (resultEl) {
        resultEl.className = "form-message";
        resultEl.textContent = "";
      }
    }

    form.addEventListener("input", function (e) {
      if (e.target && e.target.classList) e.target.classList.remove("invalid");
    });

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      clearErrors();

      if (!form.reportValidity()) return;

      const data = new FormData(form);
      const quantity = Number(data.get("quantity") || 1);
      const phone = normalizePhone(data.get("phone"));
      const productId = options.getProductId
        ? String(options.getProductId() || "")
        : String(data.get("productId") || "");

      if (!productId) {
        showMessage("اختر المنتج أولاً.", "error");
        if (wilayaSelect) wilayaSelect.focus();
        return;
      }

      const localErrors = [];
      if (!/^0[567]\d{8}$/.test(phone)) {
        localErrors.push("رقم الهاتف الجزائري غير صحيح. استعمل 05 / 06 / 07.");
        const phoneInput = form.querySelector('input[name="phone"]');
        if (phoneInput) phoneInput.classList.add("invalid");
      }
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
        localErrors.push("الكمية يجب أن تكون بين 1 و10.");
        const qtyInput = form.querySelector('input[name="quantity"]');
        if (qtyInput) qtyInput.classList.add("invalid");
      }
      const delivery = data.get("deliveryCompany");
      if (delivery !== "Yalidine" && delivery !== "ZR Express") {
        localErrors.push("اختر شركة التوصيل.");
      }
      if (localErrors.length) {
        showMessage(localErrors.join(" "), "error");
        return;
      }

      const payload = {
        productId: productId,
        fullName: String(data.get("fullName") || "").trim(),
        phone: phone,
        wilayaCode: String(data.get("wilayaCode") || ""),
        commune: String(data.get("commune") || "").trim(),
        address: String(data.get("address") || "").trim(),
        quantity: quantity,
        deliveryCompany: delivery,
        notes: String(data.get("notes") || "").trim(),
        source: options.source || "homepage",
        sessionId: window.DZStoreChat ? window.DZStoreChat.getSessionId() : ""
      };

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.dataset.originalText = submitBtn.textContent;
        submitBtn.textContent = "جاري إرسال الطلب...";
      }

      try {
        const result = await window.DZStoreAPI.submitOrder(payload);

        if (resultEl) {
          resultEl.className = "form-message show success";
          resultEl.innerHTML =
            "<strong>تم استلام طلبك.</strong><br>" +
            "رقم الطلب: <strong>" + escapeHtml(result.orderRef) + "</strong><br>" +
            "المنتج: " + escapeHtml(result.productName) + "<br>" +
            "الكمية: " + escapeHtml(String(result.quantity)) + "<br>" +
            "مجموع المنتجات: " + priceHtml(result.totalDa, "price-inline") + " (دون مصاريف التوصيل)<br>" +
            escapeHtml(result.message);
          resultEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
        } else {
          showMessage(result.message, "success");
        }

        if (window.DZStoreChat) {
          window.DZStoreChat.setOrderContext(result);
          window.DZStoreChat.notifyOrderReceived(result);
        }

        if (typeof options.onSuccess === "function") options.onSuccess(result, payload);
      } catch (error) {
        console.error(error);
        const fields = error.data && error.data.fields ? error.data.fields : {};
        Object.keys(fields).forEach(function (key) {
          const input = form.querySelector('[name="' + key + '"]');
          if (input) input.classList.add("invalid");
        });
        const firstField = Object.keys(fields)[0];
        const detail = firstField ? (fieldLabels[firstField] || firstField) + ": " + fields[firstField] : "";
        showMessage((error.message || "تعذر إرسال الطلب.") + (detail ? " " + detail : ""), "error");
        if (typeof options.onError === "function") options.onError(error);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = submitBtn.dataset.originalText || "إرسال الطلب";
        }
      }
    });

    return {
      form: form,
      showMessage: showMessage,
      clearErrors: clearErrors
    };
  };

  function escapeHtml(value) {
    return String(value === null || value === undefined ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // French grouping gives narrow no-break spaces; normalise every space variant to a
  // plain space so the amount is always "4 300" (and never "4300" or a weird gap).
  function formatAmount(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "";
    return n.toLocaleString("fr-FR").replace(/[\u202f\u00a0\u2009]/g, " ");
  }

  function formatDa(value) {
    const amount = formatAmount(value);
    return amount ? amount + " دج" : "غير متوفر";
  }

  // The page is RTL, so a bare "4 300 دج" string is laid out by the bidi algorithm with
  // "دج" on the left and the amount on the right — the price looks reversed
  // ("دج 300 4"). Every price is therefore an isolated LTR unit: the amount reads
  // left-to-right and the currency stays on its right, e.g. "4 300 دج".
  function priceInnerHtml(value) {
    const amount = formatAmount(value);
    if (!amount) return "غير متوفر";
    return (
      '<span class="price-amount">' + amount + "</span>" +
      ' <span class="price-currency" dir="rtl">دج</span>'
    );
  }

  function priceHtml(value, className) {
    return (
      '<span class="' + (className || "price-inline") + '" dir="ltr">' +
        priceInnerHtml(value) +
      "</span>"
    );
  }

  // Native <option> text cannot contain elements, so the same LTR isolation is applied
  // with the bidi controls LRI (U+2066) / PDI (U+2069) around the amount + currency.
  function pricePlain(value) {
    const amount = formatAmount(value);
    if (!amount) return "غير متوفر";
    return "\u2066" + amount + " دج\u2069";
  }

  window.DZStoreFormatDa = formatDa;
  window.DZStoreFormatAmount = formatAmount;
  window.DZStorePriceInnerHtml = priceInnerHtml;
  window.DZStorePriceHtml = priceHtml;
  window.DZStorePricePlain = pricePlain;
  window.DZStoreEscapeHtml = escapeHtml;
})();
