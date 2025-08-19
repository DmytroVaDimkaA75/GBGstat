const STATE = {
  participants: [],   // [{participantId, clan:{id,name,flag}}]
  provinces: [],      // [{id,title,ownerId,ownerName,lockedUntil,isOpen,isAttackBattleType}]
  mapId: null,
  updatedAt: 0,
};

const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
};
const nowSec = () => Math.trunc(Date.now() / 1000);

const buildParticipantsMap = (arr) => {
  const m = new Map();
  for (const p of arr || []) {
    const pid = p?.participantId ?? p?.id;
    const name = p?.clan?.name || "";
    if (pid != null) m.set(pid, name);
  }
  return m;
};

function applyWsBattleground(rd) {
  const provinces = rd?.map?.provinces;
  const parts = rd?.battlegroundParticipants;
  if (!Array.isArray(provinces) || !Array.isArray(parts)) return;

  STATE.mapId = rd.map.id || STATE.mapId;
  const nameByPid = buildParticipantsMap(parts);
  const t = nowSec();

  STATE.participants = parts.map(p => ({
    participantId: p?.participantId ?? p?.id ?? null,
    clan: { id: p?.clan?.id ?? null, name: p?.clan?.name ?? "", flag: p?.clan?.flag ?? "" }
  })).filter(x => x.participantId !== null);

  STATE.provinces = provinces.map(p => {
    const id   = p.id;
    const ttl  = p.title || "";                         // у більшості світів title тут є
    const own  = (p.ownerId !== undefined) ? p.ownerId : null;
    const lock = toInt(p.lockedUntil);                  // сек (unix), 0/undefined => відкрито
    const open = !lock || lock <= t;

    return {
      id,
      title: ttl,
      ownerId: own,
      ownerName: own != null ? (nameByPid.get(own) || `#${own}`) : "Ніхто",
      lockedUntil: lock > 0 ? lock : 0,
      isOpen: open,
      isAttackBattleType: !!p.isAttackBattleType,
    };
  });

  STATE.updatedAt = Date.now();

  // Для дебагу — чіткий підсумок у консолі розширення
  console.log("[GBG] provinces:", STATE.provinces.length,
              "participants:", STATE.participants.length,
              "map:", STATE.mapId);
  console.table(STATE.provinces.map(p => ({
    id: p.id, title: p.title, owner: p.ownerName,
    status: p.isOpen ? "відкрито" : `закрито до ${new Date(p.lockedUntil*1000).toLocaleTimeString()}`
  })));
}

// Прийом із content
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "WS_GBG" && msg.json) {
    applyWsBattleground(msg.json);
  }
  if (msg?.type === "getState") {
    sendResponse({ state: STATE });
  }
});
