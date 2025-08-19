(function () {
  const $meta = document.getElementById("meta");
  const $tbl  = document.getElementById("tbl");
  const $tb   = $tbl.querySelector("tbody");

  function secsToClock(sec) {
    if (!sec || sec <= 0) return "";
    const now = Math.floor(Date.now()/1000);
    const diff = sec - now;
    if (diff <= 0) return "відкрито";
    const h = Math.floor(diff/3600);
    const m = Math.floor((diff%3600)/60);
    const s = diff%60;
    const pad = (n) => (n<10 ? "0"+n : ""+n);
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }

  function render(state) {
    const provinces = Array.isArray(state?.provinces) ? state.provinces : [];
    const parts = Array.isArray(state?.participants) ? state.participants : [];

    const ownersById = new Map(parts.map(p => [p.participantId ?? p.id, p]));

    $tb.innerHTML = "";
    provinces.forEach(p => {
      const owner = ownersById.get(p.ownerId);
      const ownerName = owner?.clan?.name || owner?.name || (p.ownerId==null ? "—" : String(p.ownerId));
      const max = (p.conquestProgress && p.conquestProgress[0]?.maxProgress) || 0;
      const sum = (p.conquestProgress || []).reduce((a,c)=>a + (c?.progress||0), 0);

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${p.id}</td>
        <td>${escapeHtml(p.title || "")}</td>
        <td class="right">${secsToClock(p.lockedUntil)}</td>
        <td class="right">${escapeHtml(ownerName)}</td>
        <td>${sum}/${max}</td>
      `;
      $tb.appendChild(tr);
    });

    $meta.textContent = `Прив'язані провінції: ${provinces.length}` +
      (state?.lastFullMapAt ? ` • оновлено: ${new Date(state.lastFullMapAt).toLocaleTimeString()}` : "");
    $tbl.hidden = provinces.length === 0;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  function load() {
    chrome.runtime.sendMessage({ type: "getState" }, (resp) => {
      if (!resp?.ok) {
        $meta.textContent = "Немає даних. Відкрий карту GBG у грі.";
        return;
      }
      render(resp.state || {});
    });
  }

  load();
})();
