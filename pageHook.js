// Вставляється у сторінку через <script> з content.js
(() => {
  const GBG_MSG = (payload) => {
    window.postMessage({ __gbg__: true, ...payload }, "*");
  };

  // -------------------- HTTP: fetch/XMLHttpRequest --------------------
  const isInterestingURL = (url) => {
    // 1) статика з провінціями (дає name/short/links)
    if (/\/assets\/guild_battlegrounds\/map\/provinces\/.+\.json(\?|$)/i.test(url)) return true;
    // 2) інколи карта /map/background/.*.json також приходить — не потрібна
    // 3) метадані id=battleground_maps/… можуть знадобитись, але вони без власників — ігноруємо
    return false;
  };

  const parseJSONSafe = async (resp) => {
    try { return await resp.clone().json(); } catch { return null; }
  };

  // fetch
  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const res = await origFetch.apply(this, args);
    try {
      const url = String(args[0]?.url || args[0]);
      if (isInterestingURL(url)) {
        const json = await parseJSONSafe(res);
        if (json && typeof json === "object") {
          GBG_MSG({ kind: "HTTP_JSON", url, json });
        }
      }
    } catch {}
    return res;
  };

  // xhr
  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url, async, user, pass) {
    this.__gbg_url = url;
    return origOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function (body) {
    this.addEventListener("load", () => {
      try {
        const url = String(this.__gbg_url || "");
        if (isInterestingURL(url)) {
          const text = this.responseText || "";
          try {
            const json = JSON.parse(text);
            if (json && typeof json === "object") {
              GBG_MSG({ kind: "HTTP_JSON", url, json });
            }
          } catch {}
        }
      } catch {}
    });
    return origSend.apply(this, arguments);
  };

  // -------------------- WebSocket: GuildBattlegroundService --------------------
  const origWS = window.WebSocket;
  window.WebSocket = function (...args) {
    const ws = new origWS(...args);

    const origSend = ws.send;
    ws.send = function (data) {
      try {
        // нічого не фільтруємо тут, головне — чути відповіді
      } catch {}
      return origSend.apply(ws, arguments);
    };

    ws.addEventListener("message", (ev) => {
      try {
        const data = typeof ev.data === "string" ? ev.data : "";
        // На клієнті FoE це JSON масив або об'єкт
        // шукаємо відповіді GuildBattlegroundService.getBattleground
        const parsed = JSON.parse(data);
        const frames = Array.isArray(parsed) ? parsed : [parsed];

        for (const f of frames) {
          const m = f?.requestClass || f?.className || f?.type;
          const n = f?.requestMethod || f?.methodName || f?.method;
          const rd = f?.responseData ?? f?.data ?? f?.payload;

          // універсальні поля у клієнта FoE можуть відрізнятись між світами, залишаємо три варіанти
          if (
            (m === "GuildBattlegroundService" && (n === "getBattleground" || n === "getState")) ||
            (m === "GuildBattlegroundStateService" && n === "getState")
          ) {
            if (rd && typeof rd === "object") {
              // ці відповіді містять map.provinces + battlegroundParticipants
              GBG_MSG({ kind: "WS_GBG", json: rd });
            }
          }
        }
      } catch {
        // ігноруємо не-JSON
      }
    });

    return ws;
  };
})();
