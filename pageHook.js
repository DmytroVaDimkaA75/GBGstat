// [GBG/hook] runs in page context
(function () {
  const TAG = "[GBG/hook]";

  console.log(TAG, "injected");
  const post = (payload) => {
    try { window.postMessage({ __foe_hook__: true, ...payload }, "*"); } catch {}
  };
  post({ kind: "ping", from: "pageHook" });

  // ---- евристики для розпізнавання GBG ----
  const URL_HINTS = ["Battleground", "battleground", "GuildBattleground", "guild_battleground"];
  const BODY_KEYS = ["requestClass","responseClass","class","service","requestMethod"];

  const looksLikeGBGUrl = (url = "") => URL_HINTS.some(k => url.includes(k));
  const looksLikeGBGBody = (obj) => {
    try {
      const cls = BODY_KEYS.map(k => obj?.[k]).filter(Boolean).join(" ");
      if (/(Guild)?Battleground/i.test(cls)) return true;
      // іноді немає класів — шукаємо в JSON
      return /Battleground|guild_battleground/i.test(JSON.stringify(obj));
    } catch {
      return false;
    }
  };

  // ---------- fetch -----------
  const _fetch = window.fetch;
  window.fetch = async function (input, init) {
    const res = await _fetch(input, init);
    try {
      const url = typeof input === "string" ? input : input?.url || "";
      if (!url) return res;
      if (!looksLikeGBGUrl(url)) return res;

      const clone = res.clone();
      clone.json().then((body) => {
        const isGBG = looksLikeGBGBody(body);
        console.log(TAG, "xhr/fetch hit", url, isGBG ? "GBG✅" : "maybe");
        if (isGBG) post({ kind: "http", url, body });
      }).catch(() => {/* не JSON – ігноруємо */});
    } catch {}
    return res;
  };

  // ---------- XHR -------------
  const _open = XMLHttpRequest.prototype.open;
  const _send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (m, u) { this._url = u; return _open.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function () {
    this.addEventListener("load", () => {
      try {
        const url = this._url || "";
        if (!looksLikeGBGUrl(url)) return;
        const ct = this.getResponseHeader("content-type") || "";
        if (!ct.includes("application/json")) return;
        const body = JSON.parse(this.responseText);
        const isGBG = looksLikeGBGBody(body);
        console.log(TAG, "xhr hit", url, isGBG ? "GBG✅" : "maybe");
        if (isGBG) post({ kind: "http", url, body });
      } catch {}
    });
    return _send.apply(this, arguments);
  };

  // ---------- WebSocket -------
  const _WS = window.WebSocket;
  window.WebSocket = function (url, protocols) {
    const ws = protocols ? new _WS(url, protocols) : new _WS(url);
    ws.addEventListener("message", (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (/Battleground|guild_battleground/i.test(JSON.stringify(data))) {
          console.log(TAG, "ws hit GBG✅");
          post({ kind: "ws", msg: data });
        }
      } catch { /* не JSON */ }
    });
    return ws;
  };
})();
