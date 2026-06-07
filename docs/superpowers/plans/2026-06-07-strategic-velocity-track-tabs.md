# Strategic Velocity Track Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `ALL · RUN TIME · OFFLINE PRODUCT · RESEARCH` tab row to the Strategic Velocity (investor) page that filters the Burn-Up chart, KPI Health cards, and Milestones list to a track, with a per-track velocity index alongside the global one, and relabel `advisory` → "Advisor".

**Architecture:** One data set (`MILESTONES`), filtered three ways. A track is a named group of KPIs defined by a static `INVESTOR_TRACKS` map in `roadmap-data.js`. The chart already filters via the existing `Burnup.setVisibleKpis(set)` (used by the legend), so `burnup.js` is untouched — the active track just drives that set plus which KPI cards/milestone columns/legend items render. `recompute()` computes a per-track weighted index for the header and a separate global index. No backend, API, route, or data changes; Internal view untouched.

**Tech Stack:** Vanilla JS (no framework, no build step), canvas renderer (IIFE singleton), Flask static serving. No test runner or linter exists in this repo (per CLAUDE.md), so verification is manual: restart the server, `curl` the served assets for expected markup, and a browser checklist.

**Track → KPI partition (the single source of truth, all 7 KPIs, no overlap):**

| Track id | Label | KPIs |
|---|---|---|
| `all` | ALL | runtime, compliance, advisory, agenticai, hallucination, vllm, versatility |
| `runtime` | RUN TIME | runtime, vllm, versatility |
| `offline` | OFFLINE PRODUCT | advisory, compliance |
| `research` | RESEARCH | agenticai, hallucination |

**Conventions to follow (from the existing code):**
- CSS variables already defined: `--text`, `--text-dim`, `--text-faint`, `--bg`, `--border`, `--border-bright`, `--mono`, `--ease`, `--good`, `--warn`.
- Tab buttons mirror the existing `.mode-btn` / `.mode-btn.active` styling.
- The page loads scripts in order: `roadmap-data.js` → `burnup.js` → `investors-app.js`; modules talk through globals (no imports).

**How to run/verify throughout:**
- Start (or restart) the server: `uv run python app.py` — serves on http://127.0.0.1:5173 ; `/investors.html` is the page under change. Flask `debug=True` hot-reloads Python, but **static JS/CSS/HTML changes require only a browser refresh** (hard-refresh to dodge cache: Cmd-Shift-R).
- If the server is already running in the background from earlier, you do not need to restart it for static-file edits.

**Task order rationale:** Task 1 (data) and Task 2 (markup/CSS) are inert prep. Task 3 makes `recompute()` track-aware *while `ACTIVE_TRACK` is still always `all`*, so it's a behavior-preserving refactor that leaves the app working. Task 4 then wires the tabs; because `recompute()` is already track-aware, filtering cards/grid and switching tracks works without the null-card crash that would occur if the tabs were wired before the refactor.

---

### Task 1: Track model + "Advisor" relabel (`roadmap-data.js`)

Pure data-layer change. After this task the page looks identical except the `advisory` KPI now displays as **ADVISOR**; the track constants exist but nothing reads them yet.

**Files:**
- Modify: `static/js/roadmap-data.js`

- [ ] **Step 1: Relabel `advisory` to ADVISOR**

In `INVESTOR_KPI_LABELS` (around line 13-21), change the `advisory` line. Replace:

```js
  advisory: 'ADVISORY',
```

with:

```js
  advisory: 'ADVISOR',
```

Leave the key `advisory` and every other label untouched.

- [ ] **Step 2: Add the track model + active-track state**

Immediately after the `INVESTOR_KPI_TAGLINES` object closes (after line 41, before the `const ROADMAP_START` line), insert:

```js
/* Strategic tracks — named groups over INVESTOR_KPIS. The partition is
   exhaustive and non-overlapping (every KPI is in exactly one non-'all'
   track). 'all' is the default and shows the full board. This map is the
   single place to assign a KPI to a track. */
const INVESTOR_TRACKS = [
  { id: 'all',      label: 'ALL',             kpis: INVESTOR_KPIS },
  { id: 'runtime',  label: 'RUN TIME',        kpis: ['runtime', 'vllm', 'versatility'] },
  { id: 'offline',  label: 'OFFLINE PRODUCT', kpis: ['advisory', 'compliance'] },
  { id: 'research', label: 'RESEARCH',        kpis: ['agenticai', 'hallucination'] },
];

/* Transient demo state (not persisted), like TODAY_DATE / CHART_MODE. */
let ACTIVE_TRACK = 'all';

/* KPIs belonging to a track id; falls back to all KPIs for unknown ids. */
function trackKpis(trackId) {
  const t = INVESTOR_TRACKS.find(x => x.id === trackId);
  return t ? t.kpis : INVESTOR_KPIS;
}
```

- [ ] **Step 3: Verify the file parses and the label changed**

Restart is not required (static asset). Run:

```bash
curl -s http://127.0.0.1:5173/static/js/roadmap-data.js | grep -nE "advisory: 'ADVISOR'|INVESTOR_TRACKS|function trackKpis"
```

Expected: three matching lines printed (the relabel, the tracks array, the helper). If the server is not running, start it first with `uv run python app.py`.

- [ ] **Step 4: Verify in browser (regression)**

Hard-refresh http://127.0.0.1:5173/investors.html . Expected: the page renders exactly as before **except** the KPI previously labeled "ADVISORY" now reads "ADVISOR" in the KPI Health card, the milestones column header, and the burn-up legend. No console errors.

- [ ] **Step 5: Commit**

```bash
git add static/js/roadmap-data.js
git commit -m "Add investor track model + relabel advisory as Advisor"
```

---

### Task 2: Tab container, header global readout, modal label (`investors.html` + `investors.css`)

Adds the empty tab container (filled by JS in Task 4), a hidden global-index readout in the header, the modal dropdown relabel, and the tab CSS. After this task the tab bar styling exists but is empty until Task 4.

**Files:**
- Modify: `investors.html`
- Modify: `static/css/investors.css`

- [ ] **Step 1: Add the empty track-tabs nav after the view-switcher**

In `investors.html`, find the closing `</nav>` of the `view-switcher` block (line 44). Immediately after it (before the `<section class="timeline" ...>` at line 46), insert:

```html
  <nav class="track-tabs" id="track-tabs" aria-label="Track filter"></nav>
```

- [ ] **Step 2: Add the global-index readout to the header**

In `investors.html`, in the `kpi-display` block (lines 28-33), after the `overall-status` span (line 31), insert a new span:

```html
      <span class="kpi-global" id="overall-global" hidden>CO —</span>
```

The block should now read:

```html
    <div class="kpi-display">
      <span class="kpi-label">VELOCITY INDEX</span>
      <span class="kpi-value" id="overall-value">0%</span>
      <span class="kpi-status" id="overall-status">—</span>
      <span class="kpi-global" id="overall-global" hidden>CO —</span>
    </div>
```

- [ ] **Step 3: Relabel the modal's Advisory dropdown option**

In `investors.html`, in the `#ms-kpi` select (lines 109-117), change:

```html
            <option value="advisory">Advisory</option>
```

to:

```html
            <option value="advisory">Advisor</option>
```

(Value stays `advisory`.)

- [ ] **Step 4: Add tab + global-readout CSS**

Append to `static/css/investors.css`:

```css
/* =============================================================
   Track tabs — strategic-dimension filter row
   ============================================================= */
.track-tabs {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 36px;
  border-bottom: 1px solid var(--border);
  position: relative;
  z-index: 1;
}
.track-tab {
  font-family: var(--mono);
  font-size: 9px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  background: transparent;
  color: var(--text-dim);
  border: 1px solid var(--border-bright);
  padding: 5px 12px;
  cursor: pointer;
  transition: all 160ms var(--ease);
}
.track-tab:hover {
  color: var(--text);
  border-color: var(--text-dim);
}
.track-tab.active {
  color: var(--bg);
  background: var(--text);
  border-color: var(--text);
}

/* Global company index shown beside the per-track index when a
   non-ALL track is active. */
.kpi-global {
  font-family: var(--mono);
  font-size: 9px;
  letter-spacing: 0.18em;
  color: var(--text-faint);
  text-transform: uppercase;
  margin-top: 2px;
}

@media (max-width: 720px) {
  .track-tabs { padding: 8px 20px; flex-wrap: wrap; }
}
```

- [ ] **Step 5: Verify markup + CSS served**

```bash
curl -s http://127.0.0.1:5173/investors.html | grep -nE 'id="track-tabs"|id="overall-global"|<option value="advisory">Advisor<'
curl -s http://127.0.0.1:5173/static/css/investors.css | grep -nE '\.track-tab\b|\.kpi-global\b'
```

Expected: the three HTML lines and the two CSS selectors print.

- [ ] **Step 6: Verify in browser**

Hard-refresh `/investors.html`. Expected: an empty thin bar sits below the view-switcher (no tabs yet — that's Task 4). The header is unchanged ("CO —" is `hidden`). Opening the milestone modal (click any `+` or `⋯`) shows "Advisor" in the KPI dropdown. No console errors.

- [ ] **Step 7: Commit**

```bash
git add investors.html static/css/investors.css
git commit -m "Add track-tabs container, global-index readout, tab CSS"
```

---

### Task 3: Make `recompute()` track-aware (`investors-app.js`)

Refactor `recompute()` to compute a per-track index for the header plus a separate global index, and to update only the KPI cards that exist in the DOM. Do this **before** wiring the tabs: at this point `ACTIVE_TRACK` is always `all`, so `activeKpis` is all 7 KPIs and the behavior is identical to today — but the function is now safe to call after Task 4 filters the cards. This prevents the "Cannot read properties of null" crash that would happen if a non-ALL track were active while `recompute()` still assumed all 7 cards exist.

**Files:**
- Modify: `static/js/investors-app.js`

- [ ] **Step 1: Replace `recompute()` with a track-aware version**

Replace the entire `recompute()` function (lines 275-327) with:

```js
function recompute() {
  const activeKpis = trackKpis(ACTIVE_TRACK);
  const todayTs = parseDate(TODAY_DATE);

  let trackActualW = 0, trackPlannedW = 0, trackWeight = 0;
  let globalActualW = 0, globalPlannedW = 0, globalWeight = 0;

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
    globalPlannedW += plannedPct * kpiWeight;
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
```

- [ ] **Step 2: Verify behavior is unchanged (ALL only)**

Hard-refresh `/investors.html`. `ACTIVE_TRACK` is still `all` (no tabs yet), so expected:
- VELOCITY INDEX, ON PLAN, and all 7 KPI cards show the **same** numbers as before this task (regression — the refactor is behavior-preserving at `all`).
- The "CO …%" readout stays `hidden`.
- Ship/un-ship a milestone and drag the TODAY scrubber: numbers update live, no console errors.

- [ ] **Step 3: Commit**

```bash
git add static/js/investors-app.js
git commit -m "Make recompute track-aware (per-track + global index), behavior-preserving at ALL"
```

---

### Task 4: Render tabs + apply track filter to chart, cards, grid, legend (`investors-app.js`)

Render the tabs from `INVESTOR_TRACKS` and wire clicking a tab to filter every KPI-driven panel. `recompute()` is already track-aware (Task 3), so switching to a non-ALL track filters cards/grid and shows the per-track + global index correctly.

**Files:**
- Modify: `static/js/investors-app.js`

- [ ] **Step 1: Render the tabs and wire click handling**

Add these two functions to `investors-app.js` (place them just above `function renderKpiCards()` at line 119):

```js
function renderTrackTabs() {
  const nav = document.getElementById('track-tabs');
  if (!nav) return;
  nav.innerHTML = INVESTOR_TRACKS.map(t => `
    <button type="button" class="track-tab ${t.id === ACTIVE_TRACK ? 'active' : ''}"
      data-track="${t.id}">${t.label}</button>
  `).join('');
  nav.querySelectorAll('.track-tab').forEach(btn => {
    btn.addEventListener('click', () => setActiveTrack(btn.dataset.track));
  });
}

function setActiveTrack(trackId) {
  ACTIVE_TRACK = trackId;
  document.querySelectorAll('.track-tab').forEach(b =>
    b.classList.toggle('active', b.dataset.track === trackId));
  // Chart: reuse the existing visible-KPI mechanism (same one the legend uses).
  Burnup.setVisibleKpis(new Set(trackKpis(trackId)));
  // Panels that list KPIs re-render to the active track's KPIs only.
  renderKpiCards();
  renderMilestonesGrid();
  renderLegend();
  recompute();
}
```

- [ ] **Step 2: Filter KPI cards to the active track**

In `renderKpiCards()` (line 120-141), change the iteration source from `INVESTOR_KPIS` to the active track's KPIs. Replace:

```js
  container.innerHTML = INVESTOR_KPIS.map(kpi => `
```

with:

```js
  container.innerHTML = trackKpis(ACTIVE_TRACK).map(kpi => `
```

(Everything else in the function is unchanged.)

- [ ] **Step 3: Filter the milestones grid to the active track**

In `renderMilestonesGrid()` (line 144-159), change the outer iteration source. Replace:

```js
  container.innerHTML = INVESTOR_KPIS.map(kpi => {
```

with:

```js
  container.innerHTML = trackKpis(ACTIVE_TRACK).map(kpi => {
```

(The inner `MILESTONES.filter(m => m.kpi === kpi)` and event wiring stay as-is.)

- [ ] **Step 4: Filter the legend to the active track**

In `renderLegend()` (line 241-262), change the toggle list source so the legend only shows the active track's KPIs. Replace:

```js
  c.innerHTML = INVESTOR_KPIS.map(k => `
```

with:

```js
  c.innerHTML = trackKpis(ACTIVE_TRACK).map(k => `
```

(The appended PLANNED / TODAY / hint meta items and the click wiring stay unchanged.)

- [ ] **Step 5: Call `renderTrackTabs()` during init**

In `initInvestors()` (lines 5-25), add the tab render alongside the other initial renders. After the line `renderKpiCards();` (line 17), insert:

```js
  renderTrackTabs();
```

- [ ] **Step 6: Verify filtering + per-track index in browser**

Hard-refresh `/investors.html`. Expected:
- Four tabs render: `ALL · RUN TIME · OFFLINE PRODUCT · RESEARCH`, with `ALL` active; the board matches the original full view, "CO …%" hidden.
- Click **RESEARCH** → chart shows only AGENTIC AI + HALLUCINATION polygons; KPI Health shows only those two cards; Milestones shows only those two columns; legend shows only those two KPIs. VELOCITY INDEX switches to that track's weighted actual %, ON PLAN to its planned %, and "CO NN%" appears with the unchanged company index.
- Click **OFFLINE PRODUCT** → only ADVISOR + COMPLIANCE everywhere; index updates.
- Click **RUN TIME** → only RUNTIME + vLLM HOOKING + VERSATILITY everywhere; index updates.
- Click **ALL** → full board returns; "CO …%" hides; index equals the global number.
- No console errors (in particular, no "Cannot read properties of null"). Dragging the TODAY scrubber and ship/un-ship still update the visible polygons and both indices.

- [ ] **Step 7: Commit**

```bash
git add static/js/investors-app.js
git commit -m "Render track tabs and filter chart, cards, grid, legend by track"
```

---

### Task 5: Full regression pass

No code change — a final manual checklist confirming the feature and that nothing else regressed.

**Files:** none.

- [ ] **Step 1: Run the checklist in the browser**

Hard-refresh `/investors.html` and confirm each:

- [ ] Tabs render in order `ALL · RUN TIME · OFFLINE PRODUCT · RESEARCH`; `ALL` is active on load.
- [ ] `ALL` reproduces the original full board (7 KPIs in chart, cards, milestones, legend).
- [ ] Each non-ALL tab shows exactly its KPIs in **all four** places (chart polygons, KPI cards, milestone columns, legend) per the partition table at the top of this plan.
- [ ] Per-track VELOCITY INDEX + ON PLAN update on tab change; "CO NN%" appears for non-ALL tabs and is hidden on ALL.
- [ ] "ADVISOR" (not "ADVISORY") appears in the KPI card, milestone column header, legend, and the modal dropdown; the KPI key is still `advisory` (ship/edit/create on that KPI still persists correctly).
- [ ] Legend "click a KPI to isolate" still works *within* a track (e.g., on RUN TIME, clicking vLLM HOOKING hides only that polygon).
- [ ] TODAY scrubber drag, STEP/SMOOTH mode toggle, milestone ship/un-ship, and the add/edit/delete modal all still work while a non-ALL track is active.
- [ ] Internal view (`/`) is completely unchanged.
- [ ] Browser console is clean (no errors) across all tab switches.

- [ ] **Step 2: Confirm no backend/data changes crept in**

```bash
git status --porcelain
git diff --stat main -- app.py data/ pyproject.toml
```

Expected: `app.py`, `data/`, and `pyproject.toml` show **no** changes (data files are gitignored anyway). Only the four front-end files and the two docs files differ from the start of the branch.

---

## Self-Review notes

- **Spec coverage:** tabs (Task 4) · track→KPI partition (Task 1) · ALL default (Task 1 state + Task 4 render) · chart/cards/milestones filter together (Task 4) · per-track + global index (Task 3 + wired in Task 4) · Advisor relabel in label/legend/cards/modal (Tasks 1 & 2) · no backend/route/data change, Internal view untouched (Task 5 verification). All spec sections map to a task.
- **No-overlap partition** matches the spec's table exactly (runtime/vllm/versatility · advisory/compliance · agenticai/hallucination).
- **`burnup.js` deliberately untouched:** the spec anticipated a "draw a KPI subset" change, but the existing `Burnup.setVisibleKpis(set)` already provides it; reusing it is DRY and removes a file from scope.
- **Type/name consistency:** `trackKpis(id)` returns an array; `setVisibleKpis` takes a `Set` (hence `new Set(trackKpis(...))`); `ACTIVE_TRACK` is a track **id** string; `INVESTOR_TRACKS[].kpis` are KPI strings matching `INVESTOR_KPIS`. `renderKpiCards` / `renderMilestonesGrid` / `renderLegend` / `recompute` all read `trackKpis(ACTIVE_TRACK)` consistently.
- **Ordering safety:** the `recompute()` refactor (Task 3) lands *before* the tab wiring (Task 4). Task 3 is behavior-preserving at `ACTIVE_TRACK='all'`, and Task 4 relies on it so that filtering cards never leaves `recompute()` dereferencing a missing card. The two front-end-logic tasks are independent commits but Task 4 depends on Task 3 — do not reorder them.