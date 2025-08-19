const TAG='[GBG/bg]';
const state={}; // { [tabId]: {provinces:[], updatedAt:number} }

function simplifyProvince(p){
  return {
    id:p.id,
    title:p.title||p.name,
    ownerId:p.ownerId ?? p.owner?.id,
    owner:(p.owner&&p.owner.name)||p.owner||p.ownerId,
    lockedUntil:p.lockedUntil,
    isAttackBattleType: !!p.isAttackBattleType
  };
}
function applyFullMap(tabId, body){
  const map=body?.responseData?.map || body?.map;
  const provs=map?.provinces;
  if (!Array.isArray(provs)) return;
  state[tabId]={ provinces: provs.map(simplifyProvince), updatedAt: Date.now() };
  console.log(TAG,'FULL_MAP saved. provinces:', state[tabId].provinces.length);
}
function applyWsDelta(tabId, msg){
  const d=msg?.responseData?.[0];
  if (!d || !state[tabId]?.provinces) return;
  state[tabId].provinces = state[tabId].provinces.map(p=> p.id===d.id ? {
    ...p,
    ownerId: d.ownerId ?? p.ownerId,
    lockedUntil: d.lockedUntil ?? p.lockedUntil,
    isAttackBattleType: (typeof d.isAttackBattleType==='boolean')? d.isAttackBattleType : p.isAttackBattleType
  } : p);
  state[tabId].updatedAt=Date.now();
  console.log(TAG,'WS delta applied for id', d.id);
}

chrome.runtime.onInstalled.addListener(()=>console.log(TAG,'installed'));
chrome.runtime.onMessage.addListener((msg,sender,sendResponse)=>{
  const tabId = sender.tab?.id;
  if (msg?.type==='GET_STATE'){
    sendResponse(state[msg.tabId ?? tabId] || {provinces:[], updatedAt:0});
    return true;
  }
  if (!tabId) return;
  if (msg.kind==='ping'){ console.log(TAG,'ping from pageHook'); }
  if (msg.kind==='http'){ applyFullMap(tabId, msg.body); }
  if (msg.kind==='ws'){ applyWsDelta(tabId, msg.msg); }
});
