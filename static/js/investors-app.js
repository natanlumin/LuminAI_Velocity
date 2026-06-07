/* =============================================================
   Strategic Velocity — page wiring.
   ============================================================= */

async function initInvestors() {
  try {
    MILESTONES = await fetch('/api/milestones').then(r => r.json());
  } catch (e) {
    console.error('Failed to load milestones — backend running?', e);
    MILESTONES = [];
  }

  Burnup.init();
  Burnup.startLoop();

  renderTimeline();
  renderKpiCards();
  renderMilestonesGrid();
  renderLegend();
  renderModeToggle();
  initModal();
  recompute();

  requestAnimationFrame(() => Burnup.resize());
}

async function reloadMilestones() {
  try {
    const fresh = await fetch('/api/milestones').then(r => r.json());
    MILESTONES.length = 0;
    MILESTONES.push(...fresh);
    renderMilestonesGrid();
    recompute();
  } catch (e) {
    console.error('Reload failed', e);
  }
}

function renderTimeline() {
  const slider = document.getElementById('timeline-slider');
  slider.min = 0;
  slider.max = ROADMAP_TOTAL_DAYS;

  const today = parseDate(TODAY_DATE);
  const elapsed = Math.round((today - ROADMAP_START_TS) / 86400000);
  slider.value = elapsed;

  // Populate the TODAY readouts on load so they reflect TODAY_DATE rather
  // than the static "APR 26" placeholder in the HTML (which otherwise only
  // refreshes when the scrubber is dragged).
  document.getElementById('meta-today').textContent = formatInvDate(TODAY_DATE);
  document.getElementById('tl-today').textContent = formatInvDate(TODAY_DATE);
  document.getElementById('tl-elapsed').textContent = elapsed;
  document.getElementById('tl-total').textContent = ROADMAP_TOTAL_DAYS;

  const ticks = document.getElementById('timeline-ticks');
  const monthNames = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const start = new Date(ROADMAP_START_TS);
  let cur = new Date(start.getFullYear(), start.getMonth(), 1);
  if (cur.getTime() < ROADMAP_START_TS) cur.setMonth(cur.getMonth() + 1);
  const tickHtml = [];
  while (cur.getTime() <= ROADMAP_END_TS) {
    const days = Math.round((cur.getTime() - ROADMAP_START_TS) / 86400000);
    const pct = (days / ROADMAP_TOTAL_DAYS) * 100;
    const isJan = cur.getMonth() === 0;
    tickHtml.push(`<span class="tick ${isJan ? 'tick-major' : 'tick-minor'}" style="left:${pct}%"></span>`);
    tickHtml.push(`<span class="tick-label" style="left:${pct}%">${monthNames[cur.getMonth()]}${isJan ? ` '${String(cur.getFullYear()).slice(-2)}` : ''}</span>`);
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
  }
  ticks.innerHTML = tickHtml.join('');

  const updateFill = () => {
    const days = parseInt(slider.value, 10);
    const pct = (days / ROADMAP_TOTAL_DAYS) * 100;
    slider.style.setProperty('--tl-pct', pct + '%');
  };
  updateFill();

  slider.addEventListener('input', e => {
    setToday(parseInt(e.target.value, 10));
    updateFill();
  });

  const presetMid = Math.round(ROADMAP_TOTAL_DAYS / 2);
  document.querySelectorAll('.preset').forEach(btn => {
    let day;
    if (btn.dataset.role === 'start') day = 0;
    else if (btn.dataset.role === 'mid') day = presetMid;
    else if (btn.dataset.role === 'end') day = ROADMAP_TOTAL_DAYS;
    else if (btn.dataset.role === 'now') day = elapsed;
    btn.dataset.day = day;
    btn.addEventListener('click', () => {
      slider.value = day;
      setToday(day);
      updateFill();
    });
  });
  updatePresetActive(elapsed);
}

function setToday(daysFromStart) {
  const ts = ROADMAP_START_TS + daysFromStart * 86400000;
  const d = new Date(ts);
  TODAY_DATE = d.toISOString().slice(0, 10);
  document.getElementById('meta-today').textContent = formatInvDate(TODAY_DATE);
  document.getElementById('tl-today').textContent = formatInvDate(TODAY_DATE);
  document.getElementById('tl-elapsed').textContent = daysFromStart;
  document.getElementById('tl-total').textContent = ROADMAP_TOTAL_DAYS;
  recompute();
  updatePresetActive(daysFromStart);
}

function updatePresetActive(currentDay) {
  document.querySelectorAll('.preset').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.dataset.day, 10) === currentDay);
  });
}

function renderKpiCards() {
  const container = document.getElementById('kpi-cards');
  container.innerHTML = INVESTOR_KPIS.map(kpi => `
    <article class="kpi-card" data-kpi="${kpi}" style="--kpi-color: ${INVESTOR_KPI_COLORS[kpi]}">
      <div class="kpi-card-strip"></div>
      <div class="kpi-card-body">
        <div class="kpi-card-head">
          <span class="kpi-card-name">${INVESTOR_KPI_LABELS[kpi]}</span>
          <span class="kpi-card-status">—</span>
        </div>
        <div class="kpi-card-tagline">${INVESTOR_KPI_TAGLINES[kpi]}</div>
        <div class="kpi-card-num">
          <span class="kpi-card-actual">0</span><span class="kpi-card-pct">%</span>
          <span class="kpi-card-vsplan">vs <span class="kpi-card-planned">0</span>% planned</span>
        </div>
        <div class="kpi-card-meta">
          <span class="kpi-card-count">0/0 milestones</span>
          <span class="kpi-card-next">next: —</span>
        </div>
      </div>
    </article>
  `).join('');
}

function renderMilestonesGrid() {
  const container = document.getElementById('milestones-grid');
  container.innerHTML = INVESTOR_KPIS.map(kpi => {
    const ms = MILESTONES.filter(m => m.kpi === kpi).sort((a, b) => parseDate(a.date) - parseDate(b.date));
    return `
      <div class="ms-column" data-kpi="${kpi}" style="--kpi-color: ${INVESTOR_KPI_COLORS[kpi]}">
        <header class="ms-col-head">
          <span class="ms-col-strip"></span>
          <h3 class="ms-col-name">${INVESTOR_KPI_LABELS[kpi]}</h3>
          <button type="button" class="ms-add-btn" data-kpi="${kpi}" title="Add milestone">+</button>
        </header>
        <div class="ms-list">
          ${ms.map(milestoneTemplate).join('')}
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.ms-row').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.ms-edit')) return;
      toggleMilestone(parseInt(el.dataset.id, 10));
    });
  });
  container.querySelectorAll('.ms-edit').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = parseInt(el.dataset.id, 10);
      const m = MILESTONES.find(x => x.id === id);
      if (m) openMilestoneModal({ milestone: m });
    });
  });
  container.querySelectorAll('.ms-add-btn').forEach(el => {
    el.addEventListener('click', () => openMilestoneModal({ kpi: el.dataset.kpi }));
  });
}

function milestoneTemplate(m) {
  const completed = !!m.completedDate;
  return `
    <div class="ms-row ${completed ? 'completed' : ''}" data-id="${m.id}" role="button" tabindex="0">
      <span class="ms-check"></span>
      <span class="ms-body">
        <span class="ms-name">${escapeHtmlInv(m.name)}</span>
        <span class="ms-dates">
          <span class="ms-planned">${formatInvDate(m.date)}</span>
          ${completed ? `<span class="ms-actual">→ ${formatInvDate(m.completedDate)}</span>` : ''}
        </span>
      </span>
      <span class="ms-weight">w${m.weight}</span>
      <button type="button" class="ms-edit" data-id="${m.id}" title="Edit milestone" aria-label="Edit">⋯</button>
    </div>
  `;
}

async function toggleMilestone(id) {
  const m = MILESTONES.find(x => x.id === id);
  if (!m) return;
  const wasCompleted = !!m.completedDate;
  const endpoint = wasCompleted ? 'unship' : 'ship';

  // Ship date: default to the planned date if that date is in the past
  // (= backfilling history, ship lands where you planned). For
  // future-planned milestones, fall back to TODAY (= shipped early).
  // Override either via the ⋯ edit modal.
  let shipDate = TODAY_DATE;
  if (!wasCompleted && parseDate(m.date) <= parseDate(TODAY_DATE)) {
    shipDate = m.date;
  }

  try {
    const resp = await fetch(`/api/milestones/${id}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: shipDate }),
    });
    if (!resp.ok) throw new Error('toggle failed');
    const updated = await resp.json();
    Object.assign(m, updated);
  } catch (e) {
    console.error('Toggle persist failed', e);
    return;
  }

  const row = document.querySelector(`.ms-row[data-id="${id}"]`);
  if (row) {
    const completed = !!m.completedDate;
    row.classList.toggle('completed', completed);
    const dates = row.querySelector('.ms-dates');
    dates.innerHTML = `
      <span class="ms-planned">${formatInvDate(m.date)}</span>
      ${completed ? `<span class="ms-actual">→ ${formatInvDate(m.completedDate)}</span>` : ''}
    `;
    if (completed) Burnup.ripple(id);
  }
  recompute();
}

function renderLegend() {
  const c = document.getElementById('burnup-legend');
  c.innerHTML = INVESTOR_KPIS.map(k => `
    <button type="button" class="legend-item legend-toggle" data-kpi="${k}">
      <span class="legend-dot" style="background: ${INVESTOR_KPI_COLORS[k]}"></span>${INVESTOR_KPI_LABELS[k]}
    </button>
  `).join('') + `
    <span class="legend-item legend-meta"><span class="legend-line"></span>PLANNED</span>
    <span class="legend-item legend-meta"><span class="legend-marker"></span>TODAY</span>
    <span class="legend-item legend-meta legend-hint">CLICK A KPI TO ISOLATE</span>
  `;
  c.querySelectorAll('.legend-toggle').forEach(el => {
    el.addEventListener('click', () => {
      el.classList.toggle('off');
      const visible = new Set();
      c.querySelectorAll('.legend-toggle').forEach(t => {
        if (!t.classList.contains('off')) visible.add(t.dataset.kpi);
      });
      Burnup.setVisibleKpis(visible);
    });
  });
}

function renderModeToggle() {
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      Burnup.setMode(mode);
      CHART_MODE = mode;
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b === btn));
    });
  });
}

function recompute() {
  const activeKpis = trackKpis(ACTIVE_TRACK);
  const todayTs = parseDate(TODAY_DATE);

  let trackActualW = 0, trackPlannedW = 0, trackWeight = 0;
  let globalActualW = 0, globalWeight = 0;

  INVESTOR_KPIS.forEach(kpi => {
    const series = Burnup.buildSeries(kpi);
    const ms = MILESTONES.filter(m => m.kpi === kpi);

    const actualPct = series.actual.length > 0
      ? series.actual[series.actual.length - 1].value
      : 0;
    const plannedByToday = ms
      .filter(m => parseDate(m.date) <= todayTs)
      .reduce((s, m) => s + m.weight, 0);
    const plannedPct = series.weightTotal > 0 ? (plannedByToday / series.weightTotal) * 100 : 0;
    const kpiWeight = ms.reduce((s, m) => s + m.weight, 0);

    // Global index spans every KPI regardless of the active track.
    globalActualW += actualPct * kpiWeight;
    globalWeight += kpiWeight;

    // Only active-track KPIs contribute to the track index and have a card
    // in the DOM to update.
    if (activeKpis.includes(kpi)) {
      trackActualW += actualPct * kpiWeight;
      trackPlannedW += plannedPct * kpiWeight;
      trackWeight += kpiWeight;

      const card = document.querySelector(`.kpi-card[data-kpi="${kpi}"]`);
      if (card) {
        card.querySelector('.kpi-card-actual').textContent = actualPct.toFixed(0);
        card.querySelector('.kpi-card-planned').textContent = plannedPct.toFixed(0);
        card.querySelector('.kpi-card-count').textContent =
          `${series.completedCount}/${series.total} milestones`;

        const next = ms
          .filter(m => !m.completedDate)
          .sort((a, b) => parseDate(a.date) - parseDate(b.date))[0];
        card.querySelector('.kpi-card-next').textContent =
          next ? `next: ${truncate(next.name, 28)} · ${formatInvDate(next.date)}` : 'all milestones complete';

        const status = compareStatus(actualPct, plannedPct);
        const statusEl = card.querySelector('.kpi-card-status');
        statusEl.className = 'kpi-card-status ' + status;
        statusEl.textContent = statusLabelInv(status);
      }
    }
  });

  // Header shows the ACTIVE TRACK's index prominently.
  const trackActual = trackWeight > 0 ? trackActualW / trackWeight : 0;
  const trackPlanned = trackWeight > 0 ? trackPlannedW / trackWeight : 0;
  const trackStatus = compareStatus(trackActual, trackPlanned);

  animateNum(document.getElementById('overall-value'), trackActual, '%');
  document.getElementById('meta-onplan').textContent = trackPlanned.toFixed(0) + '%';
  const overallStatusEl = document.getElementById('overall-status');
  overallStatusEl.className = 'kpi-status ' + trackStatus;
  overallStatusEl.textContent = statusLabelInv(trackStatus);

  // Global company index, shown beside the track index only when a specific
  // track is active (on ALL it equals the track index, so it's redundant).
  const globalActual = globalWeight > 0 ? globalActualW / globalWeight : 0;
  const globalEl = document.getElementById('overall-global');
  globalEl.hidden = (ACTIVE_TRACK === 'all');
  globalEl.textContent = `CO ${globalActual.toFixed(0)}%`;
}

function compareStatus(actual, planned) {
  const diff = actual - planned;
  if (diff >= 8) return 'ahead';
  if (diff <= -8) return 'delayed';
  return 'on_track';
}

function statusLabelInv(s) {
  if (s === 'on_track') return 'ON PLAN';
  if (s === 'delayed') return 'BEHIND';
  return 'AHEAD';
}

const numAnimators = new WeakMap();
function animateNum(el, target, suffix = '') {
  let s = numAnimators.get(el);
  if (!s) {
    const cur = parseFloat((el.textContent || '0').replace(/[^\d.-]/g, '')) || 0;
    s = { current: cur, raf: null };
    numAnimators.set(el, s);
  }
  s.target = target;
  if (s.raf) return;
  const step = () => {
    const diff = s.target - s.current;
    if (Math.abs(diff) < 0.05) {
      s.current = s.target;
      el.textContent = s.current.toFixed(0) + suffix;
      s.raf = null;
      return;
    }
    s.current += diff * 0.18;
    el.textContent = s.current.toFixed(0) + suffix;
    s.raf = requestAnimationFrame(step);
  };
  s.raf = requestAnimationFrame(step);
}

function escapeHtmlInv(str) {
  return String(str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function formatInvDate(iso) {
  const d = new Date(iso + 'T00:00:00');
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const startYear = new Date(ROADMAP_START_TS).getFullYear();
  const endYear = new Date(ROADMAP_END_TS).getFullYear();
  const showYear = startYear !== endYear;
  const yr = showYear ? ` '${String(d.getFullYear()).slice(-2)}` : '';
  return `${months[d.getMonth()]} ${d.getDate()}${yr}`;
}

function truncate(s, n) {
  return s.length <= n ? s : s.slice(0, n - 1) + '…';
}

/* =============================================================
   Milestone create/edit/delete modal
   ============================================================= */

let _editingId = null;

function initModal() {
  const modal = document.getElementById('ms-modal');
  if (!modal) return;
  modal.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', closeModal));
  document.getElementById('ms-form').addEventListener('submit', submitMilestoneForm);
  document.getElementById('ms-delete').addEventListener('click', deleteFromModal);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) closeModal();
  });
}

function openMilestoneModal({ kpi = null, milestone = null } = {}) {
  const isEdit = !!milestone;
  _editingId = isEdit ? milestone.id : null;
  document.getElementById('modal-title').textContent = isEdit ? 'Edit Milestone' : 'New Milestone';
  document.getElementById('ms-kpi').value = milestone?.kpi || kpi || 'runtime';
  document.getElementById('ms-name').value = milestone?.name || '';
  // For new milestones, default to ~1 month after TODAY (sensible future plan).
  // For edits, show the saved date as-is.
  const defaultDate = (() => {
    if (milestone?.date) return milestone.date;
    const t = new Date(parseDate(TODAY_DATE));
    t.setMonth(t.getMonth() + 1);
    return t.toISOString().slice(0, 10);
  })();
  const dateInput = document.getElementById('ms-date');
  dateInput.value = defaultDate;
  // Constrain the date picker to the roadmap window so wrong-year clicks
  // are impossible.
  dateInput.min = ROADMAP_START;
  dateInput.max = ROADMAP_END;
  document.getElementById('ms-weight').value = milestone?.weight ?? 1;
  const completedInput = document.getElementById('ms-completed');
  completedInput.value = milestone?.completedDate || '';
  completedInput.min = ROADMAP_START;
  completedInput.max = ROADMAP_END;
  document.getElementById('ms-delete').hidden = !isEdit;
  document.getElementById('ms-modal').hidden = false;
  setTimeout(() => document.getElementById('ms-name').focus(), 50);
}

function closeModal() {
  document.getElementById('ms-modal').hidden = true;
  _editingId = null;
}

async function submitMilestoneForm(e) {
  e.preventDefault();
  const completedDateRaw = document.getElementById('ms-completed').value;
  const body = {
    kpi: document.getElementById('ms-kpi').value,
    name: document.getElementById('ms-name').value.trim(),
    date: document.getElementById('ms-date').value,
    weight: parseInt(document.getElementById('ms-weight').value, 10) || 1,
    completedDate: completedDateRaw || null,
  };
  if (!body.name || !body.date) return;
  const url = _editingId ? `/api/milestones/${_editingId}` : '/api/milestones';
  const method = _editingId ? 'PUT' : 'POST';
  try {
    const resp = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      alert('Save failed: ' + (err.error || resp.status));
      return;
    }
    await reloadMilestones();
    closeModal();
  } catch (err) {
    console.error('Save failed', err);
    alert('Save failed — is the server running?');
  }
}

async function deleteFromModal() {
  if (!_editingId) return;
  if (!confirm('Delete this milestone permanently?')) return;
  try {
    const resp = await fetch(`/api/milestones/${_editingId}`, { method: 'DELETE' });
    if (!resp.ok && resp.status !== 204) {
      alert('Delete failed: ' + resp.status);
      return;
    }
    await reloadMilestones();
    closeModal();
  } catch (err) {
    console.error('Delete failed', err);
  }
}

document.addEventListener('DOMContentLoaded', initInvestors);