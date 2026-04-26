/* =============================================================
   Momentum Plot — Canvas-based bubble chart with smooth physics.
   X = progress, Y = weight, R = complexity, color = primary leg.
   ============================================================= */

const Momentum = (() => {
  const COMPLEXITY_R = { S: 11, M: 17, L: 24, XL: 32 };
  const PADDING = { top: 32, right: 36, bottom: 44, left: 60 };
  const EASING = 0.16;
  const TOUCH_DUR = 800;

  let canvas, ctx, tooltipEl;
  let dpr = 1;
  let w = 0, h = 0;
  let render = new Map();
  let dashOffset = 0;
  let hovered = null;

  function init() {
    canvas = document.getElementById('momentum-canvas');
    tooltipEl = document.getElementById('momentum-tooltip');
    ctx = canvas.getContext('2d');
    canvas.addEventListener('mousemove', onMove);
    canvas.addEventListener('mouseleave', () => {
      hovered = null;
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
    render.forEach(s => {
      const { x, y } = dataToCanvas(s.progress, s.weight);
      s.x = x; s.y = y;
      s.targetX = x; s.targetY = y;
    });
  }

  function dataToCanvas(progress, weight) {
    const innerW = w - PADDING.left - PADDING.right;
    const innerH = h - PADDING.top - PADDING.bottom;
    return {
      x: PADDING.left + (progress / 100) * innerW,
      y: (h - PADDING.bottom) - (weight / 100) * innerH,
    };
  }

  function setBlocks(blocks) {
    blocks.forEach(setBlock);
  }

  function setBlock(b) {
    const { x, y } = dataToCanvas(b.progress, b.weight);
    const r = COMPLEXITY_R[b.complexity];
    const color = LEG_COLORS[b.legs[0]];
    const secondary = b.legs[1] ? LEG_COLORS[b.legs[1]] : null;
    const existing = render.get(b.id);
    if (existing) {
      existing.targetX = x;
      existing.targetY = y;
      existing.targetR = r;
      existing.color = color;
      existing.secondary = secondary;
      existing.progress = b.progress;
      existing.weight = b.weight;
      existing.block = b;
    } else {
      render.set(b.id, {
        x, y, r,
        targetX: x, targetY: y, targetR: r,
        color, secondary,
        progress: b.progress, weight: b.weight,
        block: b,
        lastTouch: 0,
      });
    }
  }

  function updateBlock(b) {
    setBlock(b);
    const s = render.get(b.id);
    if (s) s.lastTouch = performance.now();
  }

  function startLoop() { requestAnimationFrame(frame); }

  function frame() {
    render.forEach(s => {
      s.x += (s.targetX - s.x) * EASING;
      s.y += (s.targetY - s.y) * EASING;
      s.r += (s.targetR - s.r) * EASING;
    });
    dashOffset = (dashOffset + 0.4) % 12;
    draw();
    requestAnimationFrame(frame);
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    drawGrid();
    drawAxes();
    drawExpectedLine();
    drawBubbles();
  }

  function drawGrid() {
    ctx.save();
    ctx.strokeStyle = 'rgba(26,25,22,0.05)';
    ctx.lineWidth = 1;
    const innerW = w - PADDING.left - PADDING.right;
    const innerH = h - PADDING.top - PADDING.bottom;
    for (let p = 0; p <= 100; p += 10) {
      const x = PADDING.left + (p / 100) * innerW;
      ctx.beginPath();
      ctx.moveTo(x, PADDING.top);
      ctx.lineTo(x, h - PADDING.bottom);
      ctx.stroke();
      const y = (h - PADDING.bottom) - (p / 100) * innerH;
      ctx.beginPath();
      ctx.moveTo(PADDING.left, y);
      ctx.lineTo(w - PADDING.right, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawAxes() {
    ctx.save();
    ctx.strokeStyle = 'rgba(26,25,22,0.22)';
    ctx.fillStyle = 'rgba(94,93,86,0.95)';
    ctx.font = '500 9px "Geist Mono", "JetBrains Mono", monospace';
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(PADDING.left, PADDING.top - 6);
    ctx.lineTo(PADDING.left, h - PADDING.bottom);
    ctx.lineTo(w - PADDING.right + 6, h - PADDING.bottom);
    ctx.stroke();

    const innerW = w - PADDING.left - PADDING.right;
    const innerH = h - PADDING.top - PADDING.bottom;
    for (let p = 0; p <= 100; p += 25) {
      const x = PADDING.left + (p / 100) * innerW;
      ctx.beginPath();
      ctx.moveTo(x, h - PADDING.bottom);
      ctx.lineTo(x, h - PADDING.bottom + 5);
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(`${p}`, x, h - PADDING.bottom + 9);
    }
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

    ctx.fillStyle = 'rgba(151,149,140,1)';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText('PROGRESS  →', w - PADDING.right, h - PADDING.bottom + 26);
    ctx.textAlign = 'left';
    ctx.fillText('↑  WEIGHT', PADDING.left - 4, PADDING.top - 18);

    ctx.restore();
  }

  function drawExpectedLine() {
    const { x } = dataToCanvas(EXPECTED_PACE, 0);
    ctx.save();
    ctx.strokeStyle = 'rgba(26,25,22,0.40)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 5]);
    ctx.lineDashOffset = -dashOffset;
    ctx.beginPath();
    ctx.moveTo(x, PADDING.top - 6);
    ctx.lineTo(x, h - PADDING.bottom);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.fillStyle = 'rgba(26,25,22,0.7)';
    ctx.font = '500 9px "Geist Mono", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`EXPECTED · ${EXPECTED_PACE.toFixed(0)}%`, x + 6, PADDING.top - 5);
    ctx.restore();
  }

  function drawBubbles() {
    const items = [...render.values()].sort((a, b) => b.r - a.r);
    const now = performance.now();

    items.forEach(s => {
      const status = statusFor(s.progress, EXPECTED_PACE);

      if (status === 'ahead') {
        const haloR = s.r + 8 + Math.sin(now / 700) * 1.8;
        ctx.save();
        ctx.fillStyle = hexA(s.color, 0.16);
        ctx.beginPath();
        ctx.arc(s.x, s.y, haloR, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      const since = now - s.lastTouch;
      if (since < TOUCH_DUR) {
        const t = since / TOUCH_DUR;
        const eased = 1 - Math.pow(1 - t, 3);
        const ringR = s.r + 4 + eased * 32;
        const alpha = (1 - t) * 0.6;
        ctx.save();
        ctx.strokeStyle = hexA(s.color, alpha);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(s.x, s.y, ringR, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      ctx.save();
      const grad = ctx.createRadialGradient(
        s.x - s.r * 0.35, s.y - s.r * 0.35, 1,
        s.x, s.y, s.r
      );
      grad.addColorStop(0, lighten(s.color, 0.24));
      grad.addColorStop(1, s.color);
      ctx.fillStyle = grad;
      if (status === 'delayed') ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.strokeStyle = darken(s.color, 0.35);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      if (s.secondary) {
        ctx.save();
        ctx.strokeStyle = s.secondary;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r + 3, -Math.PI * 0.85, -Math.PI * 0.15);
        ctx.stroke();
        ctx.restore();
      }

      if (hovered === s) {
        ctx.save();
        ctx.strokeStyle = 'rgba(26,25,22,0.85)';
        ctx.lineWidth = 1.25;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r + 7, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.font = `600 ${Math.max(9, Math.floor(s.r / 2.2))}px "Geist Mono", "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${s.block.id}`, s.x, s.y + 0.5);
      ctx.restore();
    });
  }

  function onMove(e) {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    let hit = null, dist = Infinity;
    render.forEach(s => {
      const d = Math.hypot(mx - s.x, my - s.y);
      if (d < s.r + 6 && d < dist) { hit = s; dist = d; }
    });
    hovered = hit;
    if (hit) {
      tooltipEl.hidden = false;
      tooltipEl.innerHTML = renderTooltip(hit.block);
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

  function renderTooltip(b) {
    const status = statusFor(b.progress, EXPECTED_PACE);
    const legs = b.legs.map(l => LEG_LABELS[l]).join(' + ');
    return `
      <div class="tt-name">${escapeHtml(b.name)}</div>
      <div class="tt-meta">${b.owner.toUpperCase()} · ${b.complexity} · ${legs}</div>
      <div class="tt-row"><span class="tt-key">PROGRESS</span><span class="tt-val">${b.progress}%</span></div>
      <div class="tt-row"><span class="tt-key">WEIGHT</span><span class="tt-val">${b.weight}</span></div>
      <div class="tt-row"><span class="tt-key">CONTRIB</span><span class="tt-val">${blockContribution(b).toFixed(1)}</span></div>
      <div class="tt-status ${status}">${statusLabel(status)}</div>
    `;
  }

  function hexA(hex, a) {
    const h = hex.replace('#', '');
    const r = parseInt(h.substring(0, 2), 16);
    const g = parseInt(h.substring(2, 4), 16);
    const b = parseInt(h.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }
  function lighten(hex, amt) {
    const h = hex.replace('#', '');
    let r = parseInt(h.substring(0, 2), 16);
    let g = parseInt(h.substring(2, 4), 16);
    let b = parseInt(h.substring(4, 6), 16);
    r = Math.min(255, Math.round(r + (255 - r) * amt));
    g = Math.min(255, Math.round(g + (255 - g) * amt));
    b = Math.min(255, Math.round(b + (255 - b) * amt));
    return `rgb(${r},${g},${b})`;
  }
  function darken(hex, amt) {
    const h = hex.replace('#', '');
    let r = parseInt(h.substring(0, 2), 16);
    let g = parseInt(h.substring(2, 4), 16);
    let b = parseInt(h.substring(4, 6), 16);
    r = Math.max(0, Math.round(r * (1 - amt)));
    g = Math.max(0, Math.round(g * (1 - amt)));
    b = Math.max(0, Math.round(b * (1 - amt)));
    return `rgb(${r},${g},${b})`;
  }
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  return { init, setBlocks, updateBlock, startLoop, resize };
})();
