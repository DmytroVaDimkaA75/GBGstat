(function () {
  const TAG = '[GBG/hook]';
  console.log(TAG, 'injected');
  const TARGET = ['GuildBattlegroundService','GuildBattlegroundStateService'];
  const post = (payload)=>{ try{ window.postMessage({__foe_hook__:true,...payload},'*'); }catch{} };

  // sanity: покажемо, що хук живий
  post({kind:'ping', from:'pageHook'});

  const _fetch = window.fetch;
  window.fetch = async function(i,init){
    const res = await _fetch(i,init);
    try{
      const url = (typeof i==='string')? i : i.url;
      if (TARGET.some(k=>url.includes(k))) {
        const copy = res.clone();
        copy.json().then(body=>{
          console.log(TAG,'fetch hit:', url, body?.responseData?.map ? 'FULL_MAP' : '');
          post({kind:'http', url, body});
        }).catch(()=>{});
      }
    }catch{}
    return res;
  };

  const _open = XMLHttpRequest.prototype.open;
  const _send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(m,u){ this._url=u; return _open.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function(){
    this.addEventListener('load', ()=>{
      try{
        const url = this._url||'';
        if (TARGET.some(k=>url.includes(k))) {
          const ct = this.getResponseHeader('content-type')||'';
          if (ct.includes('application/json')) {
            const body = JSON.parse(this.responseText);
            console.log(TAG,'XHR hit:', url);
            post({kind:'http', url, body});
          }
        }
      }catch{}
    });
    return _send.apply(this, arguments);
  };

  const _WS = window.WebSocket;
  window.WebSocket = function(url,p){
    const ws = p? new _WS(url,p) : new _WS(url);
    ws.addEventListener('message', (ev)=>{
      try{
        const data = JSON.parse(ev.data);
        const cls = data?.requestClass || data?.class || '';
        if (String(cls).includes('GuildBattlegroundService')) {
          console.log(TAG,'WS delta');
          post({kind:'ws', msg:data});
        }
      }catch{}
    });
    return ws;
  };
})();
