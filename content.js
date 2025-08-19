// [GBG/content]
(function () {
  const TAG = "[GBG/content]";

  // 1) інжект pageHook у DOM
  console.log(TAG, "start: injecting pageHook");
  try {
    const s = document.createElement("script");
    s.src = chrome.runtime.getURL("pageHook.js");
    s.onload = () => s.remove();
    (document.documentElement || document.head || document.body).appendChild(s);
  } catch (e) {
    console.warn(TAG, "inject failed", e);
  }

  // 2) слухаємо повідомлення від pageHook
  window.addEventListener("message", (ev) => {
    const d = ev.data;
    if (!d || !d.__foe_hook__) return;

    if (d.kind === "ping") {
      console.log(TAG, "forward ping");
      safeSend({ type: "ping" });
      return;
    }

    if (d.kind === "http") {
      console.log(TAG, "forward http");
      safeSend({ type: "http", url: d.url, body: d.body });
      return;
    }

    if (d.kind === "ws") {
      console.log(TAG, "forward ws");
      safeSend({ type: "ws", msg: d.msg });
      return;
    }
  });

  function safeSend(payload) {
    // контекст розширення міг оновитись — захищаємося
    if (!chrome?.runtime?.id) return;
    try { chrome.runtime.sendMessage(payload); } catch {}
  }
})();
