/* Investor roadmap — 4 strategic KPIs, milestone-based progress.
   X axis is fully flexible — change ROADMAP_START / ROADMAP_END
   and every downstream component (slider, ticks, chart, series)
   recomputes from those values.                                 */

/* Strategic Velocity (investor view) — constants + runtime state.
   MILESTONES is loaded from /api/milestones at page init. */

let MILESTONES = [];

const INVESTOR_KPIS = ['runtime', 'compliance', 'advisory', 'agenticai', 'hallucination', 'vllm', 'versatility', 'multirule'];

const INVESTOR_KPI_LABELS = {
  runtime: 'RUNTIME',
  compliance: 'COMPLIANCE',
  advisory: 'ADVISOR',
  agenticai: 'AGENTIC AI',
  hallucination: 'HALLUCINATION',
  vllm: 'vLLM HOOKING',
  versatility: 'VERSATILITY',
  multirule: 'MULTIPLE RULES PARALLELISM',
};

const INVESTOR_KPI_COLORS = {
  runtime: '#1D9E75',
  compliance: '#534AB7',
  advisory: '#185FA5',
  agenticai: '#BA7517',
  hallucination: '#C13E73',
  vllm: '#14A89C',
  versatility: '#8E44AD',
  multirule: '#3FA7D6',
};

const INVESTOR_KPI_TAGLINES = {
  runtime: 'production-grade detection in live LLM deployments',
  compliance: 'EU AI Act + internal risk frameworks',
  advisory: 'HuggingFace model evaluation & risk surfacing',
  agenticai: 'multi-agent attack detection — our differentiator',
  hallucination: 'factuality + single-turn LLM security, unified',
  vllm: 'proprietary vLLM hooking — per-model, toward full coverage',
  versatility: 'breadth across models, tasks, and deployments',
  multirule: 'concurrent multi-rule evaluation per prompt — latency at scale',
};

/* Longer per-KPI descriptions — shown under the short tagline on each
   KPI health card. One to two sentences of strategic context. */
const INVESTOR_KPI_DESCRIPTIONS = {
  runtime: 'Production-grade detection running inline in live LLM deployments. From the first DLP prototype through v2 contrastive-learning detection, now hardening vLLM streaming, batching, and multi-model telemetry.',
  compliance: 'Translates the EU AI Act and our internal risk taxonomy into shippable controls — Article 9 and 13 mappings in place today, with SOC 2 readiness next on the path.',
  advisory: 'HuggingFace model evaluation and risk surfacing across vision, tabular, and generative tasks — maturing the eval pipelines toward the first customer pilot launch.',
  agenticai: 'Multi-agent attack detection, our core differentiator. From attack taxonomy and AgentDojo setup through goal-hijacking detection and a live agentic attack demo.',
  hallucination: 'Factuality detection converging with single-turn LLM security into one unified guard, validated against a dedicated hallucination eval benchmark.',
  vllm: 'Proprietary vLLM hooking brought up per model — Qwen and NVIDIA Nemotron today — advancing toward full coverage across every supported model.',
  versatility: 'Breadth across input formats, evaluation tasks, and deployment modes, made extensible through plug-in adapters on the way to full versatility coverage.',
  multirule: 'Evaluates many detection rules concurrently within a single prompt, collapsing per-rule latency at scale — 20 rules/prompt from 0.92 ms down to 0.0155 ms, heading toward full parallel coverage.',
};

/* Strategic tracks — named groups over INVESTOR_KPIS. The partition is
   exhaustive and non-overlapping (every KPI is in exactly one non-'all'
   track). 'all' is the default and shows the full board. This map is the
   single place to assign a KPI to a track. */
const INVESTOR_TRACKS = [
  { id: 'all',      label: 'ALL',             kpis: INVESTOR_KPIS },
  { id: 'runtime',  label: 'RUN TIME',        kpis: ['runtime', 'vllm', 'versatility', 'multirule'] },
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

const ROADMAP_START = '2025-07-01';
const ROADMAP_END = '2026-08-31';

let TODAY_DATE = '2026-06-03';
let CHART_MODE = 'step';

function parseDate(iso) { return new Date(iso + 'T00:00:00').getTime(); }
const ROADMAP_START_TS = parseDate(ROADMAP_START);
const ROADMAP_END_TS = parseDate(ROADMAP_END);
const ROADMAP_TOTAL_DAYS = Math.round((ROADMAP_END_TS - ROADMAP_START_TS) / 86400000);

/* Seed retained for static fallback / reference only — runtime data
   comes from /api/milestones. */
const _MILESTONES_SEED = [
  // RUNTIME — Cyber + Technology
  { id: 1,  kpi: 'runtime',    name: 'Initial DLP prototype',           date: '2025-08-15', completedDate: '2025-08-22', weight: 1 },
  { id: 2,  kpi: 'runtime',    name: 'Threat-model framework v1',       date: '2025-10-10', completedDate: '2025-10-12', weight: 1 },
  { id: 3,  kpi: 'runtime',    name: 'DLP detection v1 alpha',          date: '2025-12-15', completedDate: '2025-12-20', weight: 1 },
  { id: 4,  kpi: 'runtime',    name: 'DLP v1 GA',                       date: '2026-03-15', completedDate: '2026-03-18', weight: 1 },
  { id: 5,  kpi: 'runtime',    name: 'DLP v2 (contrastive learning)',   date: '2026-04-15', completedDate: '2026-04-20', weight: 1 },
  { id: 6,  kpi: 'runtime',    name: 'vLLM streaming + batching',       date: '2026-05-15', completedDate: null,         weight: 1 },
  { id: 7,  kpi: 'runtime',    name: 'vLLM LoRA + tensor parallel',     date: '2026-06-15', completedDate: null,         weight: 1 },
  { id: 8,  kpi: 'runtime',    name: 'Multi-model runtime telemetry',   date: '2026-07-30', completedDate: null,         weight: 1 },

  // COMPLIANCE — EU AI Act + risk frameworks
  { id: 9,  kpi: 'compliance', name: 'EU AI Act framework analysis',    date: '2025-09-20', completedDate: '2025-10-05', weight: 1 },
  { id: 10, kpi: 'compliance', name: 'Internal risk taxonomy v0.1',     date: '2025-11-30', completedDate: '2025-12-10', weight: 1 },
  { id: 11, kpi: 'compliance', name: 'EU AI Act Article 9 mapping',     date: '2026-03-30', completedDate: '2026-04-02', weight: 1 },
  { id: 12, kpi: 'compliance', name: 'EU AI Act Article 13 mapping',    date: '2026-05-21', completedDate: null,         weight: 1 },
  { id: 13, kpi: 'compliance', name: 'Internal risk taxonomy v0.2',     date: '2026-06-15', completedDate: null,         weight: 1 },
  { id: 14, kpi: 'compliance', name: 'SOC 2 readiness brief',           date: '2026-08-15', completedDate: null,         weight: 1 },

  // ADVISORY — HF model evaluation
  { id: 15, kpi: 'advisory',   name: 'Eval framework architecture',     date: '2025-09-15', completedDate: '2025-09-25', weight: 1 },
  { id: 16, kpi: 'advisory',   name: 'HF API integration layer',        date: '2025-11-20', completedDate: '2025-11-28', weight: 1 },
  { id: 17, kpi: 'advisory',   name: 'Vision pipeline scaffold',        date: '2026-01-25', completedDate: '2026-02-08', weight: 1 },
  { id: 18, kpi: 'advisory',   name: 'HF Vision eval pipeline',         date: '2026-03-25', completedDate: '2026-04-01', weight: 1 },
  { id: 19, kpi: 'advisory',   name: 'HF Tabular eval pipeline',        date: '2026-04-30', completedDate: '2026-04-25', weight: 1 },
  { id: 20, kpi: 'advisory',   name: 'Model task evals (gen / NER / cls)', date: '2026-05-30', completedDate: null,      weight: 1 },
  { id: 21, kpi: 'advisory',   name: 'Advisory UI integration',         date: '2026-06-30', completedDate: null,         weight: 1 },
  { id: 22, kpi: 'advisory',   name: 'First customer pilot launch',     date: '2026-08-15', completedDate: null,         weight: 2 },

  // AGENTIC AI — multi-agent attack research
  { id: 23, kpi: 'agenticai',  name: 'Agent attack literature review',  date: '2025-09-10', completedDate: '2025-09-22', weight: 1 },
  { id: 24, kpi: 'agenticai',  name: 'Attack taxonomy v0',              date: '2025-12-05', completedDate: '2025-12-18', weight: 1 },
  { id: 25, kpi: 'agenticai',  name: 'AgentDojo environment setup',     date: '2026-03-20', completedDate: '2026-03-22', weight: 1 },
  { id: 26, kpi: 'agenticai',  name: 'Attack scenarios mapped',         date: '2026-04-30', completedDate: '2026-04-24', weight: 1 },
  { id: 27, kpi: 'agenticai',  name: 'Multi-agent monitor prototype',   date: '2026-05-25', completedDate: null,         weight: 1 },
  { id: 28, kpi: 'agenticai',  name: 'Goal-hijacking detection',        date: '2026-07-01', completedDate: null,         weight: 2 },
  { id: 29, kpi: 'agenticai',  name: 'Agentic attack live demo',        date: '2026-08-01', completedDate: null,         weight: 1 },

  // HALLUCINATION — factuality, converging with single-turn security at 100%
  { id: 30, kpi: 'hallucination', name: 'Hallucination detection v1',                    date: '2026-05-15', completedDate: '2026-05-15', weight: 3 },
  { id: 31, kpi: 'hallucination', name: 'Hallucination eval benchmark',                  date: '2026-06-30', completedDate: null,         weight: 4 },
  { id: 32, kpi: 'hallucination', name: 'Single-turn security integration',              date: '2026-07-31', completedDate: null,         weight: 5 },
  { id: 33, kpi: 'hallucination', name: 'Unified hallucination + single-turn security',  date: '2026-08-31', completedDate: null,         weight: 8 },

  // vLLM HOOKING — proprietary hooking tech, per-model toward full coverage
  { id: 34, kpi: 'vllm', name: 'Qwen model support',               date: '2026-04-15', completedDate: '2026-04-15', weight: 1 },
  { id: 35, kpi: 'vllm', name: 'NVIDIA Nemotron support',          date: '2026-05-15', completedDate: '2026-05-15', weight: 1 },
  { id: 36, kpi: 'vllm', name: 'Full vLLM coverage (all models)',  date: '2026-08-31', completedDate: null,         weight: 3 },

  // VERSATILITY — concave ramp: fast early gains, flattening to ~35% at today
  { id: 37, kpi: 'versatility', name: 'Multi-format input support',       date: '2025-08-20', completedDate: '2025-08-20', weight: 3 },
  { id: 38, kpi: 'versatility', name: 'Multi-task evaluation modes',      date: '2025-11-15', completedDate: '2025-11-15', weight: 2 },
  { id: 39, kpi: 'versatility', name: 'Cross-modal coverage',            date: '2026-02-15', completedDate: '2026-02-15', weight: 1 },
  { id: 40, kpi: 'versatility', name: 'Custom workflow adapters',         date: '2026-05-20', completedDate: '2026-05-20', weight: 1 },
  { id: 41, kpi: 'versatility', name: 'Plug-in extensibility framework',  date: '2026-07-15', completedDate: null,         weight: 6 },
  { id: 42, kpi: 'versatility', name: 'Full versatility coverage',        date: '2026-08-31', completedDate: null,         weight: 7 },

  // MULTIPLE RULES PARALLELISM — concurrent multi-rule eval per prompt; latency at scale
  { id: 43, kpi: 'multirule', name: '20 rules/prompt @ 0.92 ms',          date: '2026-04-15', completedDate: '2026-04-15', weight: 5 },
  { id: 44, kpi: 'multirule', name: '20 rules/prompt @ 0.0155 ms',        date: '2026-06-20', completedDate: '2026-06-20', weight: 15 },
  { id: 45, kpi: 'multirule', name: 'Full multi-rule parallel coverage',  date: '2026-08-31', completedDate: null,         weight: 80 },
];