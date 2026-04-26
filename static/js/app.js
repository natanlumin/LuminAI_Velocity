/* =============================================================
   App — DOM rendering, slider wiring, KPI/leg recomputation.
   ============================================================= */

async function init() {
  try {
    BLOCKS = await fetch('/api/blocks').then(r => r.json());
  } catch (e) {
    console.error('Failed to load blocks from API — backend running?', e);
    BLOCKS = [];
  }

  Momentum.init();
  Momentum.setBlocks(BLOCKS);
  Momentum.startLoop();

  renderLegs();
  renderBlocks();
  renderLegend();
  renderTimeline();
  applyExpectedPace();
  recompute();

  requestAnimationFrame(() => Momentum.resize());
}

function renderTimeline() {
  const ticks = document.getElementById('timeline-ticks');
  const parts = [];
  for (let d = 1; d <= SPRINT_LENGTH; d++) {
    const pct = ((d - 1) / (SPRINT_LENGTH - 1)) * 100;
    const major = (d === 1 || d === SPRINT_LENGTH || d % 7 === 0);
    parts.push(`<span class="tick ${major ? 'tick-major' : 'tick-minor'}" style="position:absolute;left:${pct}%"></span>`);
    if (major) {
      parts.push(`<span class="tick-label" style="left:${pct}%">D${String(d).padStart(2,'0')}</span>`);
    }
  }
  ticks.innerHTML = parts.join('');

  const slider = document.getElementById('timeline-slider');
  const updateFill = () => {
    const pct = ((parseInt(slider.value, 10) - 1) / (SPRINT_LENGTH - 1)) * 100;
    slider.style.setProperty('--tl-pct', pct + '%');
  };
  updateFill();
  slider.addEventListener('input', e => {
    setSprintDay(parseInt(e.target.value, 10));
    updateFill();
  });

  document.querySelectorAll('.preset').forEach(btn => {
    btn.addEventListener('click', () => {
      const day = parseInt(btn.dataset.day, 10);
      slider.value = day;
      setSprintDay(day);
      updateFill();
    });
  });
}

function setSprintDay(day) {
  SPRINT_DAY = day;
  EXPECTED_PACE = (day / SPRINT_LENGTH) * 100;
  applyExpectedPace();
  refreshAllBlockStatuses();
  recompute();
  updatePresetActive();
}

function applyExpectedPace() {
  document.documentElement.style.setProperty('--expected', EXPECTED_PACE + '%');
  document.getElementById('tl-day').textContent = String(SPRINT_DAY).padStart(2, '0');
  document.getElementById('tl-pace').textContent = EXPECTED_PACE.toFixed(0);
  document.getElementById('meta-day').textContent = String(SPRINT_DAY).padStart(2, '0');
  document.getElementById('meta-pace').textContent = EXPECTED_PACE.toFixed(0);
  updatePresetActive();
}

function updatePresetActive() {
  document.querySelectorAll('.preset').forEach(btn => {
    const d = parseInt(btn.dataset.day, 10);
    btn.classList.toggle('active', d === SPRINT_DAY);
  });
}

function refreshAllBlockStatuses() {
  BLOCKS.forEach(b => {
    const row = document.querySelector(`.block[data-id="${b.id}"]`);
    if (!row) return;
    const status = statusFor(b.progress, EXPECTED_PACE);
    const statusEl = row.querySelector('.block-status');
    statusEl.className = 'block-status ' + status;
    statusEl.textContent = statusLabel(status);
  });
}

function renderLegs() {
  const container = document.getElementById('legs');
  container.innerHTML = Object.keys(LEG_WEIGHTS).map(leg => `
    <div class="leg" data-leg="${leg}" style="--leg-color: ${LEG_COLORS[leg]}">
      <div class="leg-row-1">
        <span class="leg-name">${LEG_LABELS[leg]}<span class="leg-weight">· w ${LEG_WEIGHTS[leg]}</span></span>
        <span class="leg-actual">0%</span>
      </div>
      <div class="leg-bar">
        <div class="leg-fill"></div>
        <div class="leg-expected"></div>
      </div>
      <div class="leg-row-2">
        <span class="leg-status-tag">—</span>
        <span class="leg-blocks-count"></span>
      </div>
    </div>
  `).join('');
}

function renderBlocks() {
  const container = document.getElementById('blocks');
  container.innerHTML = BLOCKS.map(blockTemplate).join('');
  container.querySelectorAll('input[type=range].block-slider').forEach(slider => {
    const updateFill = () => slider.style.setProperty('--fill-pct', slider.value + '%');
    updateFill();
    slider.addEventListener('input', e => {
      onSliderInput(parseInt(e.target.dataset.id, 10), parseInt(e.target.value, 10));
      updateFill();
    });
  });
}

function blockTemplate(b) {
  const primary = b.legs[0];
  const color = LEG_COLORS[primary];
  const status = statusFor(b.progress, EXPECTED_PACE);
  const idStr = String(b.id).padStart(2, '0');
  const milestones = b.milestones.map((m, i) =>
    `<span class="ms ${b.milestonesCompleted[i] ? 'done' : ''}" title="${escapeHtml(m)}"></span>`
  ).join('');
  const legTagText = b.legs.map(l => LEG_LABELS[l]).join(' + ') + ' · ' + b.sub.toUpperCase();
  const dueDate = formatDue(b.due);

  return `
    <article class="block" data-id="${b.id}" style="--leg-color: ${color}">
      <div class="block-strip"></div>
      <div class="block-body">
        <div class="block-head">
          <span class="block-id">#${idStr}</span>
          <h3 class="block-name">${escapeHtml(b.name)}</h3>
          <span class="block-tags">
            <span class="tag">${b.owner.toUpperCase()}</span>
            <span class="tag">${b.complexity}</span>
            <span class="tag tag-leg">${legTagText}</span>
            ${b.blocked ? '<span class="tag tag-blocked">BLOCKED</span>' : ''}
          </span>
          <span class="block-status ${status}">${statusLabel(status)}</span>
        </div>
        <p class="block-desc">${escapeHtml(b.description)}</p>
        <div class="block-controls">
          <div class="slider-wrap">
            <input type="range" class="block-slider"
              data-id="${b.id}" min="0" max="100" value="${b.progress}"
              aria-label="Progress for ${escapeHtml(b.name)}" />
          </div>
          <span class="block-pct">${b.progress}%</span>
        </div>
        <div class="block-foot">
          <span class="block-milestones" aria-label="milestones">${milestones}</span>
          <span class="block-foot-meta">
            <span class="foot-pair"><span class="key">DUE</span><span class="val">${dueDate}</span></span>
            <span class="foot-pair"><span class="key">WEIGHT</span><span class="val">${b.weight}</span></span>
            <span class="foot-pair"><span class="key">PRIORITY</span><span class="val">${b.priority.toUpperCase()}</span></span>
            <span class="foot-pair"><span class="key">TYPE</span><span class="val">${b.type.toUpperCase()}</span></span>
            ${b.dependsOn ? `<span class="foot-pair"><span class="key">DEPENDS</span><span class="val">#${String(b.dependsOn).padStart(2, '0')}</span></span>` : ''}
          </span>
        </div>
      </div>
    </article>
  `;
}

function renderLegend() {
  const container = document.getElementById('canvas-legend');
  const legs = Object.keys(LEG_LABELS).map(l => `
    <span class="legend-item">
      <span class="legend-dot" style="background: ${LEG_COLORS[l]}"></span>${LEG_LABELS[l]}
    </span>
  `).join('');
  container.innerHTML = legs + `
    <span class="legend-item">
      <span class="legend-line"></span>EXPECTED PACE
    </span>
    <span class="legend-item legend-meta" style="margin-left:auto">
      SIZE = COMPLEXITY · OUTER ARC = SECONDARY LEG
    </span>
  `;
}

function onSliderInput(blockId, value) {
  const block = BLOCKS.find(b => b.id === blockId);
  block.progress = value;

  const row = document.querySelector(`.block[data-id="${blockId}"]`);
  row.querySelector('.block-pct').textContent = value + '%';

  const status = statusFor(value, EXPECTED_PACE);
  const statusEl = row.querySelector('.block-status');
  statusEl.className = 'block-status ' + status;
  statusEl.textContent = statusLabel(status);

  Momentum.updateBlock(block);
  recompute();
  schedulePersist(blockId, value);
}

const _pendingProgress = new Map();
let _persistTimer = null;
function schedulePersist(blockId, progress) {
  _pendingProgress.set(blockId, progress);
  clearTimeout(_persistTimer);
  _persistTimer = setTimeout(flushPersist, 250);
}
async function flushPersist() {
  const updates = Array.from(_pendingProgress.entries());
  _pendingProgress.clear();
  for (const [id, progress] of updates) {
    fetch(`/api/blocks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ progress }),
    }).catch(e => console.error(`block ${id} persist failed`, e));
  }
}

function recompute() {
  const kpi = computeKPI(BLOCKS, LEG_WEIGHTS);
  animateNumber(document.getElementById('kpi-value'), kpi, 1);

  const kpiStatus = statusFor(kpi, EXPECTED_PACE);
  const kpiStatusEl = document.getElementById('kpi-status');
  kpiStatusEl.className = 'kpi-status ' + kpiStatus;
  kpiStatusEl.textContent = statusLabel(kpiStatus);

  for (const leg in LEG_WEIGHTS) {
    const score = legScore(BLOCKS, leg);
    const count = BLOCKS.filter(b => b.legs.includes(leg)).length;
    const legEl = document.querySelector(`.leg[data-leg="${leg}"]`);
    legEl.querySelector('.leg-fill').style.width = score + '%';
    legEl.querySelector('.leg-actual').textContent = score.toFixed(0) + '%';
    const tag = legEl.querySelector('.leg-status-tag');
    const lstatus = statusFor(score, EXPECTED_PACE);
    tag.className = 'leg-status-tag ' + lstatus;
    tag.textContent = statusLabel(lstatus);
    legEl.querySelector('.leg-blocks-count').textContent = `${count} ${count === 1 ? 'BLOCK' : 'BLOCKS'}`;
  }
}

const numberAnimators = new WeakMap();
function animateNumber(el, target, decimals = 0) {
  let s = numberAnimators.get(el);
  if (!s) {
    s = { current: parseFloat(el.textContent) || 0, raf: null };
    numberAnimators.set(el, s);
  }
  s.target = target;
  s.decimals = decimals;
  if (s.raf) return;
  const step = () => {
    const diff = s.target - s.current;
    if (Math.abs(diff) < 0.04) {
      s.current = s.target;
      el.textContent = s.current.toFixed(s.decimals);
      s.raf = null;
      return;
    }
    s.current += diff * 0.18;
    el.textContent = s.current.toFixed(s.decimals);
    s.raf = requestAnimationFrame(step);
  };
  s.raf = requestAnimationFrame(step);
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function formatDue(iso) {
  const d = new Date(iso);
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

document.addEventListener('DOMContentLoaded', init);
