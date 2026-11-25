(function () {
  "use strict";

  // Public, non-secret storefront configuration.
  // The WhatsApp contact number is configurable in three ways (in priority order):
  //   1. URL override: ?wa=213549296612  (digits only, with or without +)
  //   2. window.DZSTORE_WA_NUMBER set before config.js loads
  //   3. whatsappNumber below (the default business contact)
  var urlWa = "";
  try {
    urlWa = new URLSearchParams(window.location.search).get("wa") || "";
  } catch (e) {
    urlWa = "";
  }
  var configuredWa = window.DZSTORE_WA_NUMBER || "213549296612";
  var urlApi = "";
  try {
    urlApi = new URLSearchParams(window.location.search).get("api") || "";
  } catch (e) {
    urlApi = "";
  }
  var chosenWa = urlWa || configuredWa;
  var waDigits = String(chosenWa).replace(/[^0-9]/g, "");
  if (waDigits.length < 8 || waDigits.length > 15) waDigits = "213549296612";

  window.DZSTORE_CONFIG = Object.freeze({
    // Public backend base URL. It contains no credentials or supplier data.
    apiBase: urlApi || "https://uncorrectable-jeane-ungrudged.ngrok-free.dev/webhook",
    // Public GitHub Pages base used to build product links.
    siteBase: "https://riachsaid.github.io/dzstorex",
    storeName: "DZStoreX",
    // Click-to-chat business number (international digits, no + or spaces).
    whatsappNumber: waDigits,
    whatsappNumberDisplay: "+" + waDigits.slice(0, 3) + " " + waDigits.slice(3, 6) + " " + waDigits.slice(6, 9) + " " + waDigits.slice(9),
    whatsappDefaultMessage: "مرحبا DZStoreX، عندي سؤال على منتج."
  });

  // Builds a wa.me deep link with an optional pre-filled message.
  window.DZStoreWhatsAppUrl = function (message) {
    var base = "https://wa.me/" + window.DZSTORE_CONFIG.whatsappNumber;
    if (!message) return base;
    return base + "?text=" + encodeURIComponent(String(message));
  };
})();
