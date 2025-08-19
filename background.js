// [GBG/bg] service worker (MV3)
const TAG = "[GBG/bg]";

// Поточний стан
let state = {
  lastFullMapAt: 0,
  provinces: [],       // live-стан (ownerId, lockedUntil, progress, ...)
  participants: [],
  provinceMeta: []     // статичні метадані (назва/short/конекшени)
};

// Хелпери
const asArray = (v) => Array.isArray(v) ? v : [];
const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : 0;
};

chrome.runtime.onInstalled.addListener(() => {
  console.log(TAG, "installed");
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  try {
    if (!msg || typeof msg !== "object") return;

    if (msg.type === "getState") { sendResponse({ ok: true, state }); return true; }
    if (msg.type === "ping") { console.log(TAG, "ping from content"); return; }

    if (msg.type === "http") { handleHttp(msg.url, msg.body); return; }
    if (msg.type === "asset") { handleAsset(msg.url, msg.body); return; }
    if (msg.type === "ws") { handleWs(msg.msg); return; }
  } catch (e) {
    console.warn(TAG, "onMessage error", e);
  }
});

function handleHttp(url, body) {
  const full = extractFullMap(body);
  if (full) {
    state.provinces = enrichWithMeta(normaliseProvinces(full.provinces));
    state.participants = full.participants;
    state.lastFullMapAt = Date.now();
    console.log(TAG, `FULL_MAP saved. provinces: ${state.provinces.length}, participants: ${state.participants.length}`);
  }
}

function handleAsset(url, body) {
  // 1) провінції (waterfall_archipelago / volcano_archipelago)
  if (/\/assets\/guild_battlegrounds\/map\/provinces\/.*\.json/i.test(url)) {
    const meta = extractProvinceMeta(body);
    if (meta.length) {
      state.provinceMeta = meta;
      // збагачуємо вже наявний live-стан назвами/short/links
      state.provinces = enrichWithMeta(state.provinces);
      console.log(TAG, `PROVINCE_META saved: ${meta.length}`);
    }
    return;
  }

  // 2) інші json (hud, log) – можна додати за потреби
}

function handleWs(data) {
  try {
    const entries = asArray(data?.responseData);
    entries.forEach((e) => {
      if (e?.id == null) return;
      const p = state.provinces.find(x => x.id === e.id);
      if (!p) return;
      if (e.conquestProgress) p.conquestProgress = e.conquestProgress;
      if (e.ownerId !== undefined) p.ownerId = e.ownerId;
      if (e.lockedUntil !== undefined) p.lockedUntil = toInt(e.lockedUntil);
      if (e.isAttackBattleType !== undefined) p.isAttackBattleType = !!e.isAttackBattleType;
      // збережемо назву/short, якщо метадані прийшли пізніше
      const meta = state.provinceMeta.find(m => m.id === e.id);
      if (meta) Object.assign(p, pickMeta(meta));
    });
  } catch (e) {
    console.warn(TAG, "handleWs error", e);
  }
}

/* ---------- парсери ---------- */

function extractFullMap(body) {
  if (!body || typeof body !== "object") return null;

  // формат: { map:{provinces:[...]}, battlegroundParticipants:[...] }
  const mapProv = body?.map?.provinces;
  const parts   = body?.battlegroundParticipants;
  if (Array.isArray(mapProv) && Array.isArray(parts)) {
    return { provinces: mapProv, participants: parts };
  }

  // альтернативи
  if (Array.isArray(body?.provinces) && Array.isArray(body?.participants)) {
    return { provinces: body.provinces, participants: body.participants };
  }

  return null;
}

function normaliseProvinces(list) {
  return asArray(list).map(p => ({
    id: toInt(p.id),
    title: p.title || p.name || "",
    ownerId: p.ownerId ?? p.owner?.id ?? undefined,
    lockedUntil: toInt(p.lockedUntil),
    isAttackBattleType: !!(p.isAttackBattleType ?? (p.battleType === "red")),
    conquestProgress: asArray(p.conquestProgress).map(cp => ({
      participantId: cp.participantId,
      progress: toInt(cp.progress),
      maxProgress: toInt(cp.maxProgress)
    }))
  }));
}

// статичний JSON з провінціями часто має такий вигляд:
// [{ id, name, short, connections:[...], flag:{x,y}, ... }, ...]
function extractProvinceMeta(body) {
  try {
    const arr = Array.isArray(body) ? body : (Array.isArray(body?.provinces) ? body.provinces : []);
    return asArray(arr).map(e => ({
      id: toInt(e.id),
      name: e.name || e.title || "",
      short: e.short || "",
      connections: asArray(e.connections).map(toInt)
    })).filter(x => x.id >= 0);
  } catch { return []; }
}

function pickMeta(m) {
  return {
    title: m.name || "",
    short: m.short || "",
    connections: asArray(m.connections)
  };
}

function enrichWithMeta(prov) {
  if (!state.provinceMeta.length) return prov;
  const metaById = new Map(state.provinceMeta.map(m => [m.id, m]));
  return asArray(prov).map(p => {
    const meta = metaById.get(p.id);
    return meta ? { ...p, ...pickMeta(meta) } : p;
    // (title із лайв-відповіді не перезаписуємо, якщо воно вже є)
  });
}
