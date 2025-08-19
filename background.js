// Глобальний стан
const STATE = {
  participants: [],      // [{participantId, clan:{id,name,flag}}, ...]
  provinces: [],         // [{id,title,short,ownerId,lockedUntil,isAttackBattleType}, ...]
  lastFullMapAt: 0,      // Date.now() коли прийшла повна карта з WS
  meta: { mapId: null }, // volcano_archipelago / waterfall_archipelago
};

// ——— утиліти ———
const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
};
const notEmpty = (x) => x !== undefined && x !== null;

// мапа для швидкого мерджу по id
const indexBy = (arr, key) => {
  const m = new Map();
  for (const x of arr || []) m.set(x?.[key], x);
  return m;
};

// ——— нормалізація провінцій зі WS (живий стан) ———
function applyWsBattleground(rd) {
  // структура rd (узагальнено): { map:{id,provinces:[{id,title,ownerId,lockedUntil,isAttackBattleType,conquestProgress:[]}, ...]}, battlegroundParticipants:[...] }
  const map = rd?.map;
  const parts = rd?.battlegroundParticipants;

  if (Array.isArray(parts)) {
    STATE.participants = parts.map((p) => ({
      participantId: p?.participantId ?? p?.id ?? null,
      clan: { id: p?.clan?.id ?? null, name: p?.clan?.name ?? "", flag: p?.clan?.flag ?? "" },
    })).filter(x => notEmpty(x.participantId));
  }

  if (map?.provinces && Array.isArray(map.provinces)) {
    const now = Date.now();

    // мерджимо з уже відомими назвами/short (прийдуть з HTTP JSON)
    const prevIdx = indexBy(STATE.provinces, "id");

    const next = map.provinces.map((p) => {
      const prev = prevIdx.get(p.id) || {};
      const lockedUntil = toInt(p.lockedUntil); // у секундах (unix)

      return {
        id: p.id,
        title: prev.title ?? p.title ?? "", // назву збережемо, якщо FoE її дав; зазвичай беремо з HTTP
        short: prev.short ?? p.short ?? "",
        ownerId: notEmpty(p.ownerId) ? p.ownerId : (prev.ownerId ?? null),
        lockedUntil: lockedUntil > 0 ? lockedUntil : 0,
        isAttackBattleType: !!p.isAttackBattleType,
      };
    });

    STATE.provinces = next;
    STATE.meta.mapId = map.id || STATE.meta.mapId;
    STATE.lastFullMapAt = now;
  }
}

// ——— нормалізація назв/short з HTTP (статичні провінції) ———
function applyHttpProvinces(url, json) {
  // Очікуємо масив об'єктів [{id, name, short, connections, ...}, ...] або об'єкт з таким масивом
  const arr = Array.isArray(json) ? json : (Array.isArray(json?.provinces) ? json.provinces : null);
  if (!Array.isArray(arr) || arr.length === 0) return;

  const prevIdx = indexBy(STATE.provinces, "id");
  const patch = [];

  for (const raw of arr) {
    const id = raw?.id;
    if (!notEmpty(id)) continue;

    const prev = prevIdx.get(id) || {};
    const rec = {
      id,
      title: raw.name || raw.title || prev.title || "",
      short: raw.short || prev.short || "",
      ownerId: prev.ownerId ?? null,
      lockedUntil: prev.lockedUntil ?? 0,
      isAttackBattleType: prev.isAttackBattleType ?? false,
    };
    patch.push(rec);
  }

  // зливаємо: провінції з WS мають пріоритет у полях owner/lockedUntil
  const merged = indexBy(STATE.provinces, "id");
  for (const p of patch) {
    if (merged.has(p.id)) {
      const cur = merged.get(p.id);
      merged.set(p.id, {
        ...cur,
        title: p.title || cur.title,
        short: p.short || cur.short,
      });
    } else {
      merged.set(p.id, p);
    }
  }
  STATE.provinces = Array.from(merged.values());
}

// ——— прийом повідомлень від content.js ———
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  try {
    if (msg?.type === "WS_GBG" && msg.json) {
      applyWsBattleground(msg.json);
    } else if (msg?.type === "HTTP_JSON" && msg.url && msg.json) {
      // фільтрація: беремо лише `…/map/provinces/*.json`
      if (/\/assets\/guild_battlegrounds\/map\/provinces\/.+\.json(\?|$)/i.test(msg.url)) {
        applyHttpProvinces(msg.url, msg.json);
      }
    } else if (msg?.type === "getState") {
      sendResponse({ state: STATE });
      return; // важливо: для async відповіді
    }
  } catch (e) {
    console.warn("bg parse error:", e);
  }
  // до popup ми не відповідаємо (крім getState)
});

// ——— відповідь для popup ———
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "getState") {
    sendResponse({ state: STATE });
  }
});
