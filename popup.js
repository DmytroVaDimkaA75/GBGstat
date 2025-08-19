const TAG='[GBG/popup]';
function render(s){ console.log(TAG,'state', s); /* ...тут твоя таблиця... */ }

function tabId(){ return new Promise(r=>chrome.tabs.query({active:true,currentWindow:true},t=>r(t[0]?.id))); }
(async function(){
  const id = await tabId();
  const ask = ()=> chrome.runtime.sendMessage({type:'GET_STATE', tabId:id}, (s)=>render(s||{provinces:[],updatedAt:0}));
  ask(); setInterval(ask, 5000);
})();
