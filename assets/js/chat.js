(function () {
  "use strict";

  const cfg = window.DZSTORE_CONFIG;
  const storageKey = "dzstorex_session_id";
  const historyKey = "dzstorex_chat_history_v1";
  const maxStoredMessages = 80;
  let memorySessionId = null;
  let memoryHistory = [];
  let historyItems = [];
  let productId = null;
  let orderContext = null;
  let busy = false;
  let isOpen = false;
  let unread = 0;
  let typingEl = null;

  const WIDGET_MARKUP =
    '<div class="dz-chat-root" id="dzChatRoot">' +
      '<section class="dz-chat-panel" id="dzChatPanel" role="dialog" aria-modal="false" aria-labelledby="dzChatTitle" aria-hidden="true">' +
        '<div class="dz-chat-header">' +
          '<div class="dz-chat-identity">' +
            '<div class="dz-chat-avatar" aria-hidden="true">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
                '<rect x="4" y="8" width="16" height="11" rx="3"></rect>' +
                '<path d="M12 8V5"></path>' +
                '<circle cx="12" cy="4" r="1.2" fill="currentColor" stroke="none"></circle>' +
                '<circle cx="9" cy="13" r="1.2" fill="currentColor" stroke="none"></circle>' +
                '<circle cx="15" cy="13" r="1.2" fill="currentColor" stroke="none"></circle>' +
                '<path d="M9.5 16.2h5"></path>' +
                '<path d="M4 12H2.5M20 12h1.5"></path>' +
              '</svg>' +
            '</div>' +
            '<div class="dz-chat-identity-text">' +
              '<div class="dz-chat-title" id="dzChatTitle">مساعد DZStoreX</div>' +
              '<div class="dz-chat-status" id="dzChatStatus">' +
                '<span class="dz-chat-status-dot" aria-hidden="true"></span>' +
                '<span id="dzChatStatusText">متصل الآن · Qwen AI</span>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<button class="dz-chat-close" id="dzChatClose" type="button" aria-label="إغلاق المحادثة">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
          '</button>' +
        '</div>' +
        '<div class="dz-chat-messages" id="messages" role="log" aria-live="polite" aria-relevant="additions"></div>' +
        '<div class="dz-chat-footer">' +
          '<form class="dz-chat-form" id="dzChatForm" autocomplete="off">' +
            '<input id="chatInput" type="text" placeholder="اكتب بالعربية، الدارجة أو الفرنسية..." autocomplete="off" aria-label="رسالة للمساعد" dir="auto" maxlength="2000">' +
            '<button id="sendBtn" type="submit" aria-label="إرسال الرسالة">' +
              '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
                '<path d="M21 3 10.5 13.5"></path>' +
                '<path d="M21 3l-6.5 18-4-8-8-4L21 3z"></path>' +
              '</svg>' +
            '</button>' +
          '</form>' +
          '<div class="dz-chat-hint">العربية · الدارجة · Français</div>' +
        '</div>' +
      '</section>' +
      '<button class="dz-chat-fab" id="dzChatFab" type="button" aria-label="فتح مساعد DZStoreX" aria-expanded="false" aria-controls="dzChatPanel">' +
        '<span class="dz-chat-fab-icon dz-chat-fab-icon--robot" aria-hidden="true">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
            '<rect x="4" y="8" width="16" height="11" rx="3"></rect>' +
            '<path d="M12 8V5"></path>' +
            '<circle cx="12" cy="4" r="1.2" fill="currentColor" stroke="none"></circle>' +
            '<circle cx="9" cy="13" r="1.2" fill="currentColor" stroke="none"></circle>' +
            '<circle cx="15" cy="13" r="1.2" fill="currentColor" stroke="none"></circle>' +
            '<path d="M9.5 16.2h5"></path>' +
            '<path d="M4 12H2.5M20 12h1.5"></path>' +
          '</svg>' +
        '</span>' +
        '<span class="dz-chat-fab-icon dz-chat-fab-icon--close" aria-hidden="true">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
        '</span>' +
        '<span class="dz-chat-badge" id="dzChatBadge" hidden aria-hidden="true">0</span>' +
        '<span class="dz-chat-online-dot" aria-hidden="true"></span>' +
      '</button>' +
    '</div>';

  ensureWidget();

  const panelEl = document.getElementById("dzChatPanel");
  const fabEl = document.getElementById("dzChatFab");
  const closeBtn = document.getElementById("dzChatClose");
  const messagesEl = document.getElementById("messages");
  const formEl = document.getElementById("dzChatForm");
  const inputEl = document.getElementById("chatInput");
  const sendBtn = document.getElementById("sendBtn");
  const badgeEl = document.getElementById("dzChatBadge");
  const statusEl = document.getElementById("dzChatStatus");
  const statusTextEl = document.getElementById("dzChatStatusText");

  function ensureWidget() {
    if (document.getElementById("dzChatRoot")) return;
    if (!document.body) return;
    document.body.insertAdjacentHTML("beforeend", WIDGET_MARKUP);
  }

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

  function loadHistory() {
    try {
      const raw = sessionStorage.getItem(historyKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(function (item) {
        return item && typeof item.text === "string" && (item.role === "user" || item.role === "bot");
      }).slice(-maxStoredMessages);
    } catch (e) {
      return memoryHistory.slice(-maxStoredMessages);
    }
  }

  function saveHistory() {
    try {
      sessionStorage.setItem(historyKey, JSON.stringify(historyItems.slice(-maxStoredMessages)));
    } catch (e) {
      memoryHistory = historyItems.slice(-maxStoredMessages);
    }
  }

  function pushHistory(text, type, error) {
    historyItems.push({
      role: type === "user" ? "user" : "bot",
      text: text,
      error: !!error
    });
    if (historyItems.length > maxStoredMessages) {
      historyItems = historyItems.slice(-maxStoredMessages);
    }
    saveHistory();
  }

  function scrollToBottom() {
    if (!messagesEl) return;
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // A price written in a plain sentence ("... 3 550 دج") is reordered by the bidi
  // algorithm inside this RTL page, so it is wrapped in invisible LRI/PDI controls and
  // regrouped to the site's "3 550" format, keeping number-then-currency order.
  function isolatePrices(text) {
    if (typeof text !== "string" || text.indexOf("دج") === -1) return text;
    return text.replace(/(\d[\d\u00a0\u202f \u2009]*)\s*دج/g, function (match, amount) {
      const digits = String(amount).replace(/[^\d]/g, "");
      if (!digits) return match;
      const grouped = window.DZStoreFormatAmount
        ? window.DZStoreFormatAmount(Number(digits))
        : digits;
      return "\u2066" + (grouped || digits) + " دج\u2069";
    });
  }

  function renderMessage(text, type, options) {
    if (!messagesEl) return;
    const opts = options || {};
    const div = document.createElement("div");
    div.className = "dz-msg dz-msg--" + (type === "user" ? "user" : "bot");
    if (opts.error) div.className += " dz-msg--error";
    div.setAttribute("dir", "auto");
    div.textContent = type === "user" ? text : isolatePrices(text);
    messagesEl.appendChild(div);
    scrollToBottom();

    if (type === "bot" && !isOpen && !opts.silent) {
      unread += 1;
      updateBadge();
    }
  }

  function addMessage(text, type, options) {
    const opts = options || {};
    renderMessage(text, type, opts);
    if (opts.persist !== false) {
      pushHistory(text, type, opts.error);
    }
  }

  function updateBadge() {
    if (!badgeEl || !fabEl) return;
    if (unread > 0) {
      badgeEl.hidden = false;
      badgeEl.textContent = unread > 9 ? "9+" : String(unread);
    } else {
      badgeEl.hidden = true;
      badgeEl.textContent = "0";
    }
    const baseLabel = isOpen ? "إغلاق مساعد DZStoreX" : "فتح مساعد DZStoreX";
    fabEl.setAttribute("aria-label", unread > 0 ? baseLabel + " — " + unread + " رسائل جديدة" : baseLabel);
  }

  function clearUnread() {
    unread = 0;
    updateBadge();
  }

  function setOpen(open) {
    if (!panelEl || !fabEl) return;
    isOpen = !!open;
    panelEl.classList.toggle("is-open", isOpen);
    fabEl.classList.toggle("is-open", isOpen);
    panelEl.setAttribute("aria-hidden", isOpen ? "false" : "true");
    fabEl.setAttribute("aria-expanded", isOpen ? "true" : "false");
    if (isOpen) {
      clearUnread();
      setTimeout(function () {
        scrollToBottom();
      }, 240);
    }
    updateBadge();
  }

  function setConnection(state) {
    if (!statusEl || !statusTextEl) return;
    statusEl.classList.toggle("is-offline", state !== "online");
    if (fabEl) fabEl.classList.toggle("is-offline", state !== "online");
    if (state === "offline") {
      statusTextEl.textContent = "غير متصل بالإنترنت";
    } else if (state === "error") {
      statusTextEl.textContent = "تعذر الاتصال · أعد المحاولة";
    } else {
      statusTextEl.textContent = "متصل الآن · Qwen AI";
    }
  }

  function setBusy(value) {
    busy = !!value;
    if (sendBtn) sendBtn.disabled = busy;
    if (messagesEl) messagesEl.setAttribute("aria-busy", busy ? "true" : "false");
  }

  function showTyping() {
    if (!messagesEl) return;
    hideTyping();
    typingEl = document.createElement("div");
    typingEl.className = "dz-msg dz-msg--bot dz-msg--typing";
    typingEl.setAttribute("role", "status");
    typingEl.innerHTML =
      '<span class="dz-typing" aria-hidden="true"><i></i><i></i><i></i></span>' +
      '<span class="dz-visually-hidden">المساعد يكتب...</span>';
    messagesEl.appendChild(typingEl);
    scrollToBottom();
  }

  function hideTyping() {
    if (typingEl && typingEl.parentNode) typingEl.parentNode.removeChild(typingEl);
    typingEl = null;
  }

  async function askAI(message) {
    setBusy(true);
    showTyping();
    setConnection("online");

    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = controller ? setTimeout(function () { controller.abort(); }, 90000) : null;

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
        }),
        signal: controller ? controller.signal : undefined
      });

      if (!response.ok) {
        throw new Error("HTTP " + response.status);
      }

      const data = await response.json();
      if (!data.success || !data.reply) {
        throw new Error("Invalid AI response");
      }

      hideTyping();
      addMessage(data.reply, "bot");
      setConnection("online");
    } catch (error) {
      console.error(error);
      hideTyping();
      setConnection("error");
      addMessage("سمحلي، المساعد ما قدرش يتصل بالخادم حالياً. حاول بعد قليل.", "bot", { error: true });
    } finally {
      if (timer) clearTimeout(timer);
      hideTyping();
      setBusy(false);
    }
  }

  function sendChat() {
    if (!inputEl || busy) return;
    const message = inputEl.value.trim();
    if (!message) return;

    addMessage(message, "user");
    inputEl.value = "";
    inputEl.focus();
    askAI(message);
  }

  function restoreHistory() {
    historyItems = loadHistory();
    if (!historyItems.length) {
      addMessage(
        "مرحبا بيك في DZStoreX 👋\n" +
        "أنا المساعد الذكي تاعنا. نقدر نعاونك في معلومات المنتجات، الطلب والتوصيل.\n" +
        "قولّي واش حاب تعرف؟",
        "bot",
        { silent: true }
      );
      return;
    }

    historyItems.forEach(function (item) {
      renderMessage(item.text, item.role, { silent: true, error: item.error, persist: false });
    });
    scrollToBottom();
  }

  if (formEl) {
    formEl.addEventListener("submit", function (event) {
      event.preventDefault();
      sendChat();
    });
  }

  if (fabEl) {
    fabEl.addEventListener("click", function () {
      setOpen(!isOpen);
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener("click", function () {
      setOpen(false);
    });
  }

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && isOpen) {
      setOpen(false);
    }
  });

  document.addEventListener("click", function (event) {
    const trigger = event.target && event.target.closest ? event.target.closest("[data-dz-chat-open]") : null;
    if (!trigger) return;
    event.preventDefault();
    setOpen(true);
    if (inputEl) {
      setTimeout(function () { inputEl.focus(); }, 250);
    }
  });

  window.addEventListener("offline", function () { setConnection("offline"); });
  window.addEventListener("online", function () { setConnection("online"); });

  restoreHistory();
  setConnection(navigator.onLine === false ? "offline" : "online");
  updateBadge();

  window.DZStoreChat = {
    getSessionId: getSessionId,
    setProduct: function (id) {
      productId = id ? String(id) : null;
    },
    setOrderContext: function (order) {
      if (!order || !order.orderRef) {
        orderContext = null;
        return;
      }
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
    open: function () {
      setOpen(true);
    },
    close: function () {
      setOpen(false);
    },
    focus: function () {
      setOpen(true);
      setTimeout(function () {
        if (inputEl) inputEl.focus();
      }, 250);
    }
  };
})();
