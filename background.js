// [GBG/bg] service worker (MV3)
const TAG = "[GBG/bg]";

// Поточний стан
let state = {
  lastFullMapAt: 0,
  provinces: [],     // [{id, title, ownerId, lockedUntil, isAttackBattleType, conquestProgress:[...] }]
  participants: [],  // гільдії/учасники
};

// БЕЗПЕЧНІ хелпери
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

    // попап просить стан
    if (msg.type === "getState") {
      sendResponse({ ok: true, state });
      return true;
    }

    if (msg.type === "ping") {
      console.log(TAG, "ping from content");
      return;
    }

    if (msg.type === "http") {
      handleHttp(msg.url, msg.body);
      return;
    }

    if (msg.type === "ws") {
      handleWs(msg.msg);
      return;
    }
  } catch (e) {
    console.warn(TAG, "onMessage error", e);
  }
});

function handleHttp(url, body) {
  // шукаємо корисні шматки у відповіді
  // 1) повний стан мапи (як у getBattleground / metadata maps)
  const full = extractFullMap(body);
  if (full) {
    state.provinces = full.provinces;
    state.participants = full.participants;
    state.lastFullMapAt = Date.now();
    console.log(TAG, `FULL_MAP saved. provinces: ${state.provinces.length}, participants: ${state.participants.length}`);
    return;
  }

  // 2) будь-які корисні «дрібні» дані — можна розширювати
}

function handleWs(data) {
  // дельти можуть приходити по WS; реагуємо обережно
  try {
    // поширений випадок: {responseData: [{id: <provId>, conquestProgress:[...], ownerId, lockedUntil, isAttackBattleType}]}
    const entries = asArray(data?.responseData);
    entries.forEach((e) => {
      if (e?.id == null) return;
      const p = state.provinces.find(x => x.id === e.id);
      if (!p) return;
      // оновлюємо те, що прилетіло
      if (e.conquestProgress) p.conquestProgress = e.conquestProgress;
      if (e.ownerId !== undefined) p.ownerId = e.ownerId;
      if (e.lockedUntil !== undefined) p.lockedUntil = toInt(e.lockedUntil);
      if (e.isAttackBattleType !== undefined) p.isAttackBattleType = !!e.isAttackBattleType;
      console.log(TAG, "WS delta applied for province", e.id);
    });
  } catch (e) {
    console.warn(TAG, "handleWs error", e);
  }
}

/** Спроба витягнути повний опис GBG карти з різних форматів відповіді */
function extractFullMap(body) {
  if (!body || typeof body !== "object") return null;

  // 1) формат близький до FoE-Helper: { map: {provinces:[...]}, battlegroundParticipants:[...] }
  const mapProv = body?.map?.provinces;
  const parts   = body?.battlegroundParticipants;
  if (Array.isArray(mapProv) && Array.isArray(parts)) {
    return {
      provinces: normaliseProvinces(mapProv),
      participants: parts
    };
  }

  // 2) інші можливі вкладення
  if (Array.isArray(body?.provinces) && body?.participants) {
    return {
      provinces: normaliseProvinces(body.provinces),
      participants: asArray(body.participants)
    };
  }

  return null;
}

function normaliseProvinces(list) {
  // ГАРАНТІЇ: жодних .filter/.map на undefined ➜ тільки на масиві
  return asArray(list).map(p => ({
    id: toInt(p.id),
    title: p.title || p.name || "",
    ownerId: p.ownerId ?? p.owner?.id ?? undefined,
    lockedUntil: toInt(p.lockedUntil),               // seconds (з грою часто саме так)
    isAttackBattleType: !!(p.isAttackBattleType ?? (p.battleType === "red")),
    conquestProgress: asArray(p.conquestProgress).map(cp => ({
      participantId: cp.participantId,
      progress: toInt(cp.progress),
      maxProgress: toInt(cp.maxProgress)
    }))
  }));
}
