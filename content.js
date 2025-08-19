// 1) інжектуємо pageHook.js
(() => {
  const s = document.createElement("script");
  s.src = chrome.runtime.getURL("pageHook.js");
  s.onload = () => s.remove();
  (document.head || document.documentElement).appendChild(s);
})();

// 2) пересилаємо у бекграунд
window.addEventListener("message", (e) => {
  const d = e.data;
  if (!d || !d.__gbg__) return;
  chrome.runtime.sendMessage({ type: d.kind, json: d.json });
});
