/* =============================================================
   Burn-Up — cumulative non-decreasing polygon per KPI.
   X axis = calendar time (window-flexible)
   Y axis = % roadmap delivered (0-100, weighted by milestone weight)
   Mode  = 'step' (default) | 'smooth' (monotone-cubic spline)
   ============================================================= */

const Burnup = (() => {
  const PADDING = { top: 36, right: 32, bottom: 56, left: 56 };
  const TOUCH_DUR = 900;

  let canvas, ctx, tooltipEl;
  let dpr = 1;
  let w = 0, h = 0;
  let dashOffset = 0;
  let hoveredMs = null;
  let visibleKpis = new Set(INVESTOR_KPIS);
  let ripples = [];

  function init() {
    canvas = document.getElementById('burnup-canvas');
    tooltipEl = document.getElementById('burnup-tooltip');
    ctx = canvas.getContext('2d');
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseleave', () => {
      hoveredMs = null;
      tooltipEl.hidden = true;
    });
    window.addEventListener('resize', resize);
    resize();
  }

  function resize() {
    const rect = canvas.parentElement.getBoundingClientRect();
    w = rect.width;
    h = rect.height;
    dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function dateToX(ts) {
    const innerW = w - PADDING.left - PADDING.right;
    const t = (ts - ROADMAP_START_TS) / (ROADMAP_END_TS - ROADMAP_START_TS);
    return PADDING.left + Math.max(0, Math.min(1, t)) * innerW;
  }
  function valueToY(v) {
    const innerH = h - PADDING.top - PADDING.bottom;
    return (h - PADDING.bottom) - (v / 100) * innerH;
  }

  function buildSeries(kpi) {
    const ms = MILESTONES.filter(m => m.kpi === kpi);
    if (ms.length === 0) return { actual: [], planned: [], weightTotal: 0, completedCount: 0, total: 0 };

    const todayTs = parseDate(TODAY_DATE);
    const weightTotal = ms.reduce((s, m) => s + m.weight, 0);

    const completed = ms.filter(m => m.completedDate && parseDate(m.completedDate) <= todayTs)
      .sort((a, b) => parseDate(a.completedDate) - parseDate(b.completedDate));

    const actual = [{ ts: ROADMAP_START_TS, value: 0, ms: null }];
    let acc = 0;
    completed.forEach(m => {
      acc += m.weight;
      actual.push({ ts: parseDate(m.completedDate), value: (acc / weightTotal) * 100, ms: m });
    });
    actual.push({ ts: todayTs, value: (acc / weightTotal) * 100, ms: null, isToday: true });

    const planned = [{ ts: ROADMAP_START_TS, value: 0, ms: null }];
    let pAcc = 0;
    [...ms].sort((a, b) => parseDate(a.date) - parseDate(b.date)).forEach(m => {
      pAcc += m.weight;
      planned.push({ ts: parseDate(m.date), value: (pAcc / weightTotal) * 100, ms: m });
    });
    planned.push({ ts: ROADMAP_END_TS, value: 100, ms: null });

    return { actual, planned, weightTotal, completedCount: completed.length, total: ms.length };
  }

  function ripple(milestoneId) {
    ripples.push({ id: milestoneId, started: performance.now() });
  }

  function frame() {
    dashOffset = (dashOffset + 0.4) % 12;
    ripples = ripples.filter(r => performance.now() - r.started < TOUCH_DUR);
    draw();
    requestAnimationFrame(frame);
  }
  function startLoop() { requestAnimationFrame(frame); }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    drawGrid();
    drawAxes();
    drawTodayLine();

    INVESTOR_KPIS.forEach(kpi => {
      if (!visibleKpis.has(kpi)) return;
      const series = buildSeries(kpi);
      drawPlannedLine(series, INVESTOR_KPI_COLORS[kpi]);
    });
    INVESTOR_KPIS.forEach(kpi => {
      if (!visibleKpis.has(kpi)) return;
      const series = buildSeries(kpi);
      drawActualPolygon(series, INVESTOR_KPI_COLORS[kpi]);
    });
    INVESTOR_KPIS.forEach(kpi => {
      if (!visibleKpis.has(kpi)) return;
      const series = buildSeries(kpi);
      drawMilestoneDots(series, INVESTOR_KPI_COLORS[kpi]);
    });
    drawRipples();
  }

  function drawGrid() {
    ctx.save();
    ctx.strokeStyle = 'rgba(232,231,229,0.035)';
    ctx.lineWidth = 1;
    const innerW = w - PADDING.left - PADDING.right;
    const innerH = h - PADDING.top - PADDING.bottom;
    for (let p = 0; p <= 100; p += 25) {
      const y = (h - PADDING.bottom) - (p / 100) * innerH;
      ctx.beginPath();
      ctx.moveTo(PADDING.left, y);
      ctx.lineTo(w - PADDING.right, y);
      ctx.stroke();
    }

    // month vertical grid
    const months = monthBoundaries();
    months.forEach(m => {
      const x = dateToX(m.ts);
      ctx.beginPath();
      ctx.moveTo(x, PADDING.top);
      ctx.lineTo(x, h - PADDING.bottom);
      ctx.stroke();
    });
    ctx.restore();
  }

  function monthBoundaries() {
    const out = [];
    const start = new Date(ROADMAP_START_TS);
    let cur = new Date(start.getFullYear(), start.getMonth(), 1);
    if (cur.getTime() < ROADMAP_START_TS) cur.setMonth(cur.getMonth() + 1);
    while (cur.getTime() <= ROADMAP_END_TS) {
      out.push({ ts: cur.getTime(), date: new Date(cur) });
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }
    return out;
  }

  function drawAxes() {
    ctx.save();
    ctx.strokeStyle = 'rgba(232,231,229,0.20)';
    ctx.fillStyle = 'rgba(138,139,133,0.85)';
    ctx.font = '500 9px "Geist Mono", "JetBrains Mono", monospace';
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(PADDING.left, PADDING.top - 6);
    ctx.lineTo(PADDING.left, h - PADDING.bottom);
    ctx.lineTo(w - PADDING.right + 6, h - PADDING.bottom);
    ctx.stroke();

    const innerH = h - PADDING.top - PADDING.bottom;
    for (let p = 0; p <= 100; p += 25) {
      const y = (h - PADDING.bottom) - (p / 100) * innerH;
      ctx.beginPath();
      ctx.moveTo(PADDING.left, y);
      ctx.lineTo(PADDING.left - 5, y);
      ctx.stroke();
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${p}`, PADDING.left - 9, y);
    }

    const monthNames = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    const months = monthBoundaries();
    months.forEach((m, i) => {
      const x = dateToX(m.ts);
      const isJan = m.date.getMonth() === 0;
      ctx.strokeStyle = isJan ? 'rgba(232,231,229,0.30)' : 'rgba(232,231,229,0.18)';
      ctx.beginPath();
      ctx.moveTo(x, h - PADDING.bottom);
      ctx.lineTo(x, h - PADDING.bottom + (isJan ? 7 : 4));
      ctx.stroke();

      ctx.fillStyle = isJan ? 'rgba(232,231,229,0.7)' : 'rgba(138,139,133,0.85)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(monthNames[m.date.getMonth()], x, h - PADDING.bottom + 12);
      if (m.date.getMonth() === 0 || i === 0) {
        ctx.fillStyle = 'rgba(74,76,79,1)';
        ctx.fillText(`'${String(m.date.getFullYear()).slice(-2)}`, x, h - PADDING.bottom + 26);
      }
    });

    ctx.fillStyle = 'rgba(74,76,79,1)';
    ctx.textAlign = 'left';
    ctx.fillText('↑  % ROADMAP DELIVERED', PADDING.left - 4, PADDING.top - 20);
    ctx.textAlign = 'right';
    ctx.fillText('TIME →', w - PADDING.right, h - PADDING.bottom + 40);

    ctx.restore();
  }

  function drawTodayLine() {
    const ts = parseDate(TODAY_DATE);
    if (ts < ROADMAP_START_TS || ts > ROADMAP_END_TS) return;
    const x = dateToX(ts);
    ctx.save();
    ctx.strokeStyle = 'rgba(232,231,229,0.55)';
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(x, PADDING.top - 6);
    ctx.lineTo(x, h - PADDING.bottom);
    ctx.stroke();

    ctx.fillStyle = 'rgba(232,231,229,0.85)';
    ctx.font = '500 9px "Geist Mono", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('TODAY', x + 6, PADDING.top - 6);

    ctx.fillStyle = 'rgba(232,231,229,1)';
    ctx.beginPath();
    ctx.arc(x, PADDING.top - 8, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPlannedLine(series, color) {
    if (series.planned.length < 2) return;
    ctx.save();
    ctx.strokeStyle = hexA(color, 0.55);
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.lineDashOffset = -dashOffset;
    ctx.beginPath();
    if (CHART_MODE === 'smooth') {
      drawSmoothPath(series.planned);
    } else {
      drawStepPath(series.planned);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawActualPolygon(series, color) {
    if (series.actual.length < 2) return;
    const baselineY = valueToY(0);

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(dateToX(series.actual[0].ts), baselineY);
    if (CHART_MODE === 'smooth') {
      drawSmoothPath(series.actual, true);
    } else {
      drawStepPath(series.actual, true);
    }
    ctx.lineTo(dateToX(series.actual[series.actual.length - 1].ts), baselineY);
    ctx.closePath();

    const grad = ctx.createLinearGradient(0, valueToY(100), 0, baselineY);
    grad.addColorStop(0, hexA(color, 0.22));
    grad.addColorStop(1, hexA(color, 0.02));
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.25;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.shadowColor = hexA(color, 0.5);
    ctx.shadowBlur = 8;
    ctx.beginPath();
    if (CHART_MODE === 'smooth') {
      drawSmoothPath(series.actual);
    } else {
      drawStepPath(series.actual);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawStepPath(pts, isFill = false) {
    if (pts.length === 0) return;
    let prev = pts[0];
    if (isFill) {
      ctx.lineTo(dateToX(prev.ts), valueToY(prev.value));
    } else {
      ctx.moveTo(dateToX(prev.ts), valueToY(prev.value));
    }
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i];
      ctx.lineTo(dateToX(p.ts), valueToY(prev.value));
      ctx.lineTo(dateToX(p.ts), valueToY(p.value));
      prev = p;
    }
  }

  // Monotone cubic Hermite (Fritsch-Carlson) — smooth, non-decreasing
  function drawSmoothPath(pts, isFill = false) {
    if (pts.length === 0) return;
    if (pts.length === 1) {
      const x = dateToX(pts[0].ts), y = valueToY(pts[0].value);
      if (isFill) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      return;
    }
    const xs = pts.map(p => dateToX(p.ts));
    const ys = pts.map(p => valueToY(p.value));
    const n = pts.length;
    const dxs = new Array(n - 1), dys = new Array(n - 1), ds = new Array(n - 1);
    for (let i = 0; i < n - 1; i++) {
      dxs[i] = xs[i + 1] - xs[i];
      dys[i] = ys[i + 1] - ys[i];
      ds[i] = dys[i] / dxs[i];
    }
    const ms = new Array(n);
    ms[0] = ds[0];
    ms[n - 1] = ds[n - 2];
    for (let i = 1; i < n - 1; i++) {
      if (ds[i - 1] * ds[i] <= 0) {
        ms[i] = 0;
      } else {
        ms[i] = (ds[i - 1] + ds[i]) / 2;
      }
    }
    for (let i = 0; i < n - 1; i++) {
      if (ds[i] === 0) {
        ms[i] = 0;
        ms[i + 1] = 0;
      } else {
        const a = ms[i] / ds[i];
        const b = ms[i + 1] / ds[i];
        const s2 = a * a + b * b;
        if (s2 > 9) {
          const tau = 3 / Math.sqrt(s2);
          ms[i] = tau * a * ds[i];
          ms[i + 1] = tau * b * ds[i];
        }
      }
    }

    if (isFill) ctx.lineTo(xs[0], ys[0]); else ctx.moveTo(xs[0], ys[0]);
    for (let i = 0; i < n - 1; i++) {
      const dx = dxs[i];
      const c1x = xs[i] + dx / 3;
      const c1y = ys[i] + (ms[i] * dx) / 3;
      const c2x = xs[i + 1] - dx / 3;
      const c2y = ys[i + 1] - (ms[i + 1] * dx) / 3;
      ctx.bezierCurveTo(c1x, c1y, c2x, c2y, xs[i + 1], ys[i + 1]);
    }
  }

  function drawMilestoneDots(series, color) {
    for (let i = 1; i < series.actual.length; i++) {
      const p = series.actual[i];
      if (!p.ms) continue;
      const x = dateToX(p.ts);
      const y = valueToY(p.value);
      const isHovered = hoveredMs === p.ms.id;
      ctx.save();
      ctx.fillStyle = color;
      ctx.strokeStyle = '#0a0b0d';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, isHovered ? 6 : 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (isHovered) {
        ctx.strokeStyle = 'rgba(232,231,229,0.85)';
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.arc(x, y, 11, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function drawRipples() {
    const now = performance.now();
    ripples.forEach(r => {
      const m = MILESTONES.find(x => x.id === r.id);
      if (!m || !m.completedDate) return;
      const series = buildSeries(m.kpi);
      const pt = series.actual.find(p => p.ms && p.ms.id === r.id);
      if (!pt) return;
      const x = dateToX(pt.ts);
      const y = valueToY(pt.value);
      const t = (now - r.started) / TOUCH_DUR;
      const eased = 1 - Math.pow(1 - t, 3);
      const radius = 4 + eased * 36;
      const alpha = (1 - t) * 0.7;
      const color = INVESTOR_KPI_COLORS[m.kpi];
      ctx.save();
      ctx.strokeStyle = hexA(color, alpha);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });
  }

  function onMove(e) {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    let hit = null;
    let bestDist = 14;
    INVESTOR_KPIS.forEach(kpi => {
      if (!visibleKpis.has(kpi)) return;
      const series = buildSeries(kpi);
      for (let i = 1; i < series.actual.length; i++) {
        const p = series.actual[i];
        if (!p.ms) continue;
        const x = dateToX(p.ts);
        const y = valueToY(p.value);
        const d = Math.hypot(mx - x, my - y);
        if (d < bestDist) { hit = p.ms; bestDist = d; }
      }
    });
    hoveredMs = hit ? hit.id : null;
    if (hit) {
      tooltipEl.hidden = false;
      tooltipEl.innerHTML = renderTooltip(hit);
      const tw = tooltipEl.offsetWidth || 200;
      const th = tooltipEl.offsetHeight || 100;
      let tx = mx + 16;
      let ty = my + 16;
      if (tx + tw > w - 8) tx = mx - tw - 16;
      if (ty + th > h - 8) ty = my - th - 16;
      tooltipEl.style.left = tx + 'px';
      tooltipEl.style.top = ty + 'px';
    } else {
      tooltipEl.hidden = true;
    }
  }

  function renderTooltip(m) {
    const planned = formatDate(m.date);
    const actual = m.completedDate ? formatDate(m.completedDate) : null;
    const diff = m.completedDate
      ? Math.round((parseDate(m.completedDate) - parseDate(m.date)) / 86400000)
      : null;
    let diffLabel = '';
    if (diff !== null) {
      if (diff < 0) diffLabel = `<span class="tt-status ahead">${Math.abs(diff)}d EARLY</span>`;
      else if (diff > 0) diffLabel = `<span class="tt-status delayed">${diff}d LATE</span>`;
      else diffLabel = `<span class="tt-status">ON DATE</span>`;
    }
    return `
      <div class="tt-name">${escapeHtmlBu(m.name)}</div>
      <div class="tt-meta">${INVESTOR_KPI_LABELS[m.kpi]} · WEIGHT ${m.weight}</div>
      <div class="tt-row"><span class="tt-key">PLANNED</span><span class="tt-val">${planned}</span></div>
      ${actual ? `<div class="tt-row"><span class="tt-key">SHIPPED</span><span class="tt-val">${actual}</span></div>` : `<div class="tt-row"><span class="tt-key">STATUS</span><span class="tt-val">PENDING</span></div>`}
      ${diffLabel}
    `;
  }

  function setVisibleKpis(set) { visibleKpis = set; }
  function setMode(mode) { CHART_MODE = mode; }

  function hexA(hex, a) {
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }
  function escapeHtmlBu(str) {
    return String(str).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }
  function formatDate(iso) {
    const d = new Date(iso + 'T00:00:00');
    const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    return `${months[d.getMonth()]} ${d.getDate()}, '${String(d.getFullYear()).slice(-2)}`;
  }

  return { init, resize, startLoop, setVisibleKpis, setMode, ripple, buildSeries };
})();