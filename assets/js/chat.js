(function () {
  "use strict";

  const cfg = window.DZSTORE_CONFIG;
  const storageKey = "dzstorex_session_id";
  let memorySessionId = null;
  let productId = null;
  let orderContext = null;

  const messagesEl = document.getElementById("messages");
  const inputEl = document.getElementById("chatInput");
  const sendBtn = document.getElementById("sendBtn");

  function getSessionId() {
    try {
      let id = sessionStorage.getItem(storageKey);
      if (!id) {
        id = "dzstorex-" + (crypto.randomUUID ? crypto.randomUUID() : Date.now() + "-" + Math.random().toString(36).slice(2));
        sessionStorage.setItem(storageKey, id);
      }
      return id;
    } catch (e) {
      if (!memorySessionId) {
        memorySessionId = "dzstorex-" + Date.now() + "-" + Math.random().toString(36).slice(2);
      }
      return memorySessionId;
    }
  }

  function addMessage(text, type) {
    if (!messagesEl) return;
    const div = document.createElement("div");
    div.className = "msg " + (type === "user" ? "user-msg" : "bot-msg");
    div.textContent = type === "user" ? text : isolatePrices(text);
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // A price written in a plain sentence ("... 3 550 دج") is reordered by the bidi
  // algorithm inside this RTL page, so it is wrapped in invisible LRI/PDI controls and
  // keeps the same number-then-currency order as the price components.
  function isolatePrices(text) {
    if (typeof text !== "string" || text.indexOf("دج") === -1) return text;
    return text.replace(/(\d[\d\u00a0\u202f \u2009]*)\s*دج/g, function (match, amount) {
      return "\u2066" + amount.trim() + " دج\u2069";
    });
  }

  function setBusy(busy) {
    if (sendBtn) sendBtn.disabled = busy;
    if (inputEl) inputEl.disabled = busy;
  }

  async function askAI(message) {
    setBusy(true);
    try {
      const response = await fetch(cfg.apiBase + "/dzstorex/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true"
        },
        body: JSON.stringify({
          sessionId: getSessionId(),
          message: message,
          language: "darija",
          productId: productId || "",
          orderContext: orderContext || undefined
        })
      });

      if (!response.ok) {
        throw new Error("HTTP " + response.status);
      }

      const data = await response.json();
      if (!data.success || !data.reply) {
        throw new Error("Invalid AI response");
      }

      addMessage(data.reply, "bot");
    } catch (error) {
      console.error(error);
      addMessage("سمحلي، المساعد ما قدرش يتصل بالخادم حالياً. حاول بعد قليل.", "bot");
    } finally {
      setBusy(false);
    }
  }

  function sendChat() {
    if (!inputEl) return;
    const message = inputEl.value.trim();
    if (!message) return;

    addMessage(message, "user");
    inputEl.value = "";
    askAI(message);
  }

  if (sendBtn) sendBtn.addEventListener("click", sendChat);
  if (inputEl) {
    inputEl.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        sendChat();
      }
    });
  }

  window.DZStoreChat = {
    getSessionId: getSessionId,
    setProduct: function (id) {
      productId = id ? String(id) : null;
    },
    setOrderContext: function (order) {
      if (!order || !order.orderRef) return;
      orderContext = {
        orderRef: String(order.orderRef),
        status: String(order.status || "received"),
        productName: String(order.productName || ""),
        quantity: order.quantity,
        totalDa: order.totalDa
      };
    },
    notifyOrderReceived: function (order) {
      if (!order || !order.orderRef) return;
      addMessage(
        "تم استلام طلبك رقم " + order.orderRef + ". هذا ليس تأكيداً نهائياً؛ سيتواصل معك الفريق هاتفياً لتأكيد الطلب.",
        "bot"
      );
    },
    focus: function () {
      if (inputEl) inputEl.focus();
    }
  };
})();
