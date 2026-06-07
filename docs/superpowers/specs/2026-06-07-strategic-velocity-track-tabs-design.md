# Strategic Velocity — Track Tabs

**Date:** 2026-06-07
**Status:** Approved (design)
**Scope:** Strategic Velocity / investor view only (`/investors.html`). Internal view untouched.

## Goal

Split the single Strategic Velocity board into three focused **tracks** the CEO/board can drill into, without losing the all-up view. Each track is a named grouping over the existing 7 investor KPIs. Navigation is a tab row on the same page — no new routes, no backend changes, no data migration.

## Tracks → KPIs

The 7 investor KPIs (`runtime`, `compliance`, `advisory`, `agenticai`, `hallucination`, `vllm`, `versatility`) partition cleanly into three tracks — each KPI belongs to exactly one track, no overlap:

| Tab | KPIs |
|---|---|
| **ALL** (default) | all 7 |
| **Run Time** | `runtime`, `vllm`, `versatility` |
| **Offline Product** | `advisory` (displayed as **Advisor**), `compliance` |
| **Research** | `agenticai`, `hallucination` |

`ALL` is the default landing state so the current full-board experience is preserved; the three tracks are refinements.

## Behavior

**Navigation.** A second nav row beneath the existing `INTERNAL VIEW | STRATEGIC VELOCITY | MODE` switcher, with tabs `ALL · RUN TIME · OFFLINE PRODUCT · RESEARCH`. Clicking a tab sets the active track. Tab state is **transient** (not persisted), like the TODAY scrubber and chart mode.

**What filters together.** The active track filters all three KPI-driven panels at once:
- **Burn-Up chart** — draws only the active track's KPI polygons (reuses the existing per-KPI `buildSeries` / series rendering; this is a filter over which KPIs render, not a chart rewrite). The legend reflects only the visible KPIs.
- **KPI Health cards** — shows only the active track's cards.
- **Milestones list** — shows only milestones whose `kpi` is in the active track.

**Velocity index.** The top-right `VELOCITY INDEX` (and its on-plan status) shows the **active track's** index prominently, with the **global** company index still visible beside it. On the `ALL` tab the two are equal. Per-track index uses the same weighted computation the global index uses, restricted to the track's KPIs.

**"Advisor" relabel.** `INVESTOR_KPI_LABELS.advisory` changes from `ADVISORY` to **`ADVISOR`**, and the milestone modal's KPI dropdown option label `Advisory` → `Advisor`. The underlying key stays `advisory` — no data, API, or storage change.

## Architecture

One data set (the existing `MILESTONES` loaded from `/api/milestones`), multiple filtered views. A track is defined by a static `TRACK → [kpi…]` map; all filtering derives from it.

- `roadmap-data.js` — add the track definitions (`INVESTOR_TRACKS` map + ordered list with display labels), relabel `advisory` → `ADVISOR`. Add transient `ACTIVE_TRACK` state (default `all`).
- `investors-app.js` — render the tab row, hold/serve active-track state, filter KPI cards + milestones grid, compute the per-track velocity index, and tell the chart which KPIs to draw. Re-render on tab change.
- `burnup.js` — accept the set of KPIs to draw (subset of the 7); render only those polygons + legend entries. Default (ALL) = all KPIs, i.e. current behavior.
- `investors.html` — add the tab nav row markup; change the modal's `Advisory` option label to `Advisor`.
- `investors.css` — style the tab row (consistent with the existing switcher / mode buttons).

No changes to `app.py`, the API, `data/*.json`, or the Internal view files.

## Component boundaries

- **Track model** (`roadmap-data.js`): the single source of truth for which KPIs belong to which track and how tracks are labeled/ordered. Everything else reads from it.
- **Tab control + filtering** (`investors-app.js`): owns active-track state and applies the track's KPI set to each panel. Knows *what* the active track is; delegates *how to draw* to the renderers.
- **Burn-Up renderer** (`burnup.js`): given a list of KPIs, draws their series + legend. Stays agnostic of "tracks" — it only knows KPIs.

## Data flow

1. Page `init()` loads `MILESTONES` from the API (unchanged).
2. Active track defaults to `all`. Tab click updates `ACTIVE_TRACK` and triggers a re-render.
3. On render, `investors-app.js` resolves `ACTIVE_TRACK` → KPI set via the track map, then:
   - passes the KPI set to the Burn-Up renderer,
   - filters KPI Health cards and the Milestones list to that KPI set,
   - computes the track's velocity index (+ keeps the global index) and updates the header.

## Edge cases / decisions

- **Empty track:** not possible with the current partition (every track has ≥2 KPIs), but the renderers should tolerate a track whose milestones are all unshipped (chart shows flat/zero series; cards show 0%).
- **Adding a milestone while a non-ALL tab is active:** the modal still lets any of the 7 KPIs be chosen. If the new milestone's KPI isn't in the active track, it simply won't appear until the user switches to a tab that includes it (acceptable; optionally switch to its track after save — out of scope for v1).
- **New KPI added later:** it must be assigned to a track in the map, or it falls outside all three tabs (only visible under ALL). Documented as the single place to update.

## Testing

No automated test harness exists in this repo (per CLAUDE.md). Verification is manual in-browser:
- ALL tab matches the current board exactly (regression).
- Each track tab shows only its KPIs across chart, cards, and milestones.
- Velocity index changes per tab; ALL equals global.
- `ADVISOR` label appears in KPI label, legend, cards, and modal option; data/API still use `advisory`.
- Switching tabs and dragging the TODAY scrubber both still work and compose.

## Out of scope (YAGNI)

- Persisting the active tab.
- Applying tracks to the Internal view.
- Grouping the modal KPI dropdown by track (`<optgroup>`) — nice-to-have, not required.
- Auto-switching to a milestone's track after creation.