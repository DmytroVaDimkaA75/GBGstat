(function(){
  const TAG='[GBG/content]';
  console.log(TAG,'start: injecting pageHook');
  const s=document.createElement('script');
  s.src=chrome.runtime.getURL('pageHook.js');
  s.onload=()=>s.remove();
  (document.head||document.documentElement).appendChild(s);

  window.addEventListener('message',(ev)=>{
    if (!ev.data || ev.source!==window) return;
    if (ev.data.__foe_hook__===true){
      console.log(TAG,'forward', ev.data.kind);
      chrome.runtime.sendMessage(ev.data);
    }
  });
})();
