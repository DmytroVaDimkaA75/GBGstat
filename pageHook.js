// Вставляється у page context. Ловимо ЛИШЕ WS і дістаємо getBattleground.
(() => {
  const post = (payload) => window.postMessage({ __gbg__: true, ...payload }, "*");

  // Рекурсивний пошук вузла з map.provinces + battlegroundParticipants
  const findGBGPayload = (node) => {
    const seen = new Set();
    const stack = [node];
    while (stack.length) {
      const cur = stack.pop();
      if (!cur || typeof cur !== "object") continue;
      if (seen.has(cur)) continue;
      seen.add(cur);

      const hasMap = cur.map && Array.isArray(cur.map.provinces);
      const hasParts = Array.isArray(cur.battlegroundParticipants);
      if (hasMap && hasParts) return cur;

      if (Array.isArray(cur)) {
        for (const v of cur) stack.push(v);
      } else {
        for (const k of Object.keys(cur)) stack.push(cur[k]);
      }
    }
    return null;
  };

  const tryParse = (data) => {
    try { return JSON.parse(data); } catch { return null; }
  };

  const OrigWS = window.WebSocket;
  window.WebSocket = function (...args) {
    const ws = new OrigWS(...args);

    ws.addEventListener("message", (ev) => {
      if (typeof ev.data !== "string") return;
      const parsed = tryParse(ev.data);
      if (!parsed) return;

      // У клієнта FoE приходить масив кадрів або поодинокий об’єкт — обидва варіанти обробляємо.
      const frames = Array.isArray(parsed) ? parsed : [parsed];

      for (const f of frames) {
        // Багато різних форм, тому просто шукаємо потрібний «субоб’єкт»
        const payload = findGBGPayload(f?.responseData ?? f?.data ?? f);
        if (payload && payload.map && Array.isArray(payload.map.provinces)) {
          // Обрізаємо зайве, шлемо «сирі» дані в content
          post({ kind: "WS_GBG", json: {
            map: { id: payload.map.id, provinces: payload.map.provinces },
            battlegroundParticipants: payload.battlegroundParticipants
          }});
        }
      }
    });

    return ws;
  };
})();
