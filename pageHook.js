(function () {
  const TAG = '[GBG/hook]';
  console.log(TAG, 'injected');

  const URL_HINTS = ['Battleground', 'battleground', 'GuildBattleground'];
  const BODY_KEYS  = ['requestClass','responseClass','class','service','requestMethod'];

  const post = (payload) => { try { window.postMessage({ __foe_hook__: true, ...payload }, '*'); } catch {} };

  post({ kind: 'ping', from: 'pageHook' });

  function looksLikeGBGUrl(url='') {
    return URL_HINTS.some(k => url.includes(k));
  }
  function looksLikeGBGBody(obj) {
    try {
      // шукаємо ключі типу ...Class === 'GuildBattlegroundService' або рядок 'Battleground' у JSON
      const cls = BODY_KEYS.map(k => obj?.[k]).filter(Boolean).join(' ');
      if (/(Guild)?Battleground/i.test(cls)) return true;
      const s = JSON.stringify(obj);
      return /Battleground/i.test(s);
    } catch { return false; }
  }

  // -------- fetch ----------
  const _fetch = window.fetch;
  window.fetch = async function(input, init) {
    const res = await _fetch(input, init);
    try {
      const url = (typeof input === 'string') ? input : input?.url || '';
      if (looksLikeGBGUrl(url)) {
        const clone = res.clone();
        clone.json().then(body => {
          const isGBG = looksLikeGBGBody(body);
          console.log(TAG, 'fetch hit', url, isGBG ? 'GBG✅' : 'maybe');
          if (isGBG) post({ kind: 'http', url, body });
        }).catch(()=>{ /* не JSON */ });
      }
    } catch {}
    return res;
  };

  // -------- XHR -----------
  const _open = XMLHttpRequest.prototype.open;
  const _send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (m,u){ this._url=u; return _open.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function () {
    this.addEventListener('load', () => {
      try {
        const url = this._url || '';
        if (!looksLikeGBGUrl(url)) return;
        const ct = this.getResponseHeader('content-type') || '';
        if (!ct.includes('application/json')) return;
        const body = JSON.parse(this.responseText);
        const isGBG = looksLikeGBGBody(body);
        console.log(TAG, 'xhr hit', url, isGBG ? 'GBG✅' : 'maybe');
        if (isGBG) post({ kind: 'http', url, body });
      } catch {}
    });
    return _send.apply(this, arguments);
  };

  // -------- WebSocket -----
  const _WS = window.WebSocket;
  window.WebSocket = function (url, protocols) {
    const ws = protocols ? new _WS(url, protocols) : new _WS(url);
    ws.addEventListener('message', (ev) => {
      try {
        const data = JSON.parse(ev.data);
        // інколи немає *.class — робимо широке евристичне визначення
        const raw = JSON.stringify(data);
        if (/Battleground/i.test(raw)) {
          console.log(TAG, 'ws hit GBG✅');
          post({ kind: 'ws', msg: data });
        }
      } catch {
        // не JSON — пропускаємо
      }
    });
    return ws;
  };
})();
