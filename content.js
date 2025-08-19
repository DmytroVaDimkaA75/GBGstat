// 1) інжектуємо pageHook.js
(function inject() {
  const s = document.createElement("script");
  s.src = chrome.runtime.getURL("pageHook.js");
  s.onload = () => s.remove();
  (document.head || document.documentElement).appendChild(s);
})();

// 2) ловимо повідомлення від pageHook -> шлемо в бекграунд
window.addEventListener("message", (e) => {
  const d = e.data;
  if (!d || !d.__gbg__) return;
  chrome.runtime.sendMessage({ type: d.kind, url: d.url, json: d.json });
});

// 3) (за бажанням) відповіді з бекграунда у контент (не обов'язково)
// chrome.runtime.onMessage.addListener((msg) => { ... });
