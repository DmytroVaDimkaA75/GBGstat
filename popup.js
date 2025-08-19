/* popup: відображення всіх провінцій зі статусом */
const $ = (id) => document.getElementById(id);

let STATE = null;
let intervalId = null;

function fmtTimeLeft(secLeft) {
  if (secLeft <= 0) return "0с";
  const h = Math.floor(secLeft / 3600);
  const m = Math.floor((secLeft % 3600) / 60);
  const s = Math.floor(secLeft % 60);
  const mm = m.toString().padStart(2, "0");
  const ss = s.toString().padStart(2, "0");
  return h > 0 ? `${h}ч ${mm}м` : (m > 0 ? `${m}м ${ss}с` : `${s}с`);
}

function ownerNameById(id, participants) {
  if (id == null) return "Без власника";
  const p = participants?.find((x) => x.participantId === id || x.id === id || x?.clan?.id === id);
  return p?.clan?.name || p?.name || `Гільдія #${id}`;
}

function render() {
  const list = $("list");
  const empty = $("empty");

  const provinces = STATE?.provinces || [];
  const participants = STATE?.participants || [];
  const updatedAt = STATE?.lastFullMapAt || 0;

  $("provCount").textContent = `Провінцій: ${provinces.length}`;
  $("guildCount").textContent = `Гільдій: ${participants.length}`;
  $("lastUpdated").textContent = updatedAt
    ? `Оновлено: ${new Date(updatedAt).toLocaleTimeString()}`
    : "Оновлено: —";

  if (!provinces.length) {
    list.innerHTML = "";
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  // сортування: спочатку зачинені (найменший час), далі відкриті за назвою
  const now = Date.now();
  const sorted = [...provinces].sort((a, b) => {
    const aLeft = (a.lockedUntil ? a.lockedUntil * 1000 - now : 0);
    const bLeft = (b.lockedUntil ? b.lockedUntil * 1000 - now : 0);
    const aClosed = aLeft > 0, bClosed = bLeft > 0;
    if (aClosed !== bClosed) return aClosed ? -1 : 1;
    if (aClosed && bClosed) return aLeft - bLeft;
    return (a.title || a.short || "").localeCompare(b.title || b.short || "");
  });

  // рендер
  list.innerHTML = "";
  for (const p of sorted) {
    const owner = ownerNameById(p.ownerId, participants);
    const leftMs = p.lockedUntil ? p.lockedUntil * 1000 - now : 0;
    const closed = leftMs > 0;

    const row = document.createElement("div");
    row.className = "item";
    row.innerHTML = `
      <div class="title">
        <span class="short">${p.short || "—"}</span>
        <div style="display:flex; flex-direction:column; min-width:0;">
          <div class="name" title="${p.title || ""}">${p.title || "Без назви"}</div>
          <div class="owner">Власник: <span class="accent">${owner}</span></div>
        </div>
      </div>
      <div class="state">
        <div class="chip owner-chip" title="ID власника: ${p.ownerId ?? "—"}">
          ${p.ownerId != null ? `ID ${p.ownerId}` : "Без власника"}
        </div>
        <div class="chip ${closed ? "locked" : "open"}" data-locked="${p.lockedUntil || 0}">
          ${closed ? `Зачинено: ${fmtTimeLeft(Math.ceil(leftMs/1000))}` : "Відкрито"}
        </div>
      </div>
    `;
    list.appendChild(row);
  }
}

// оновлення лише таймерів (без перезбірки DOM)
function tickTimers() {
  const chips = document.querySelectorAll('.chip.locked[data-locked]');
  const now = Date.now();
  chips.forEach(ch => {
    const ts = Number(ch.getAttribute('data-locked')) || 0; // seconds (unix)
    const left = ts ? ts * 1000 - now : 0;
    if (left <= 0) {
      ch.classList.remove('locked'); ch.classList.add('open');
      ch.textContent = "Відкрито";
      ch.removeAttribute('data-locked');
    } else {
      ch.textContent = `Зачинено: ${fmtTimeLeft(Math.ceil(left/1000))}`;
    }
  });
}

async function loadState() {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ type: "getState" }, (resp) => {
        if (chrome.runtime.lastError) {
          console.warn("getState error:", chrome.runtime.lastError?.message);
          return resolve(null);
        }
        resolve(resp?.state || null);
      });
    } catch (e) {
      console.warn("getState exception:", e);
      resolve(null);
    }
  });
}

async function boot() {
  STATE = await loadState();
  render();

  // раз на 2.5с пробуємо оновити стан (раптом фон щойно підловив дані)
  // і щосекунди — оновлюємо локальні таймери
  if (intervalId) clearInterval(intervalId);
  intervalId = setInterval(() => tickTimers(), 1000);

  // м’яка авто-підгрузка свіжого стану (не флудимо)
  let refreshEvery = 2500;
  let tries = 0;
  const refId = setInterval(async () => {
    tries++;
    const next = await loadState();
    // якщо кількість провінцій зросла — перемальовуємо
    if ((next?.provinces?.length || 0) !== (STATE?.provinces?.length || 0)) {
      STATE = next;
      render();
    }
    // через ~20с перестаємо питати (таймери далі живуть локально)
    if (tries >= Math.ceil(20000 / refreshEvery)) clearInterval(refId);
  }, refreshEvery);
}

document.addEventListener("DOMContentLoaded", boot);
