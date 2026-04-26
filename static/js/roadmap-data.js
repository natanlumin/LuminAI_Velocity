/* Investor roadmap — 4 strategic KPIs, milestone-based progress.
   X axis is fully flexible — change ROADMAP_START / ROADMAP_END
   and every downstream component (slider, ticks, chart, series)
   recomputes from those values.                                 */

const INVESTOR_KPIS = ['runtime', 'compliance', 'advisory', 'agenticai'];

const INVESTOR_KPI_LABELS = {
  runtime: 'RUNTIME',
  compliance: 'COMPLIANCE',
  advisory: 'ADVISORY',
  agenticai: 'AGENTIC AI',
};

const INVESTOR_KPI_COLORS = {
  runtime: '#1D9E75',
  compliance: '#534AB7',
  advisory: '#185FA5',
  agenticai: '#BA7517',
};

const INVESTOR_KPI_TAGLINES = {
  runtime: 'production-grade detection in live LLM deployments',
  compliance: 'EU AI Act + internal risk frameworks',
  advisory: 'HuggingFace model evaluation & risk surfacing',
  agenticai: 'multi-agent attack detection — our differentiator',
};

const ROADMAP_START = '2025-07-01';
const ROADMAP_END = '2026-08-31';

let TODAY_DATE = '2026-04-26';
let CHART_MODE = 'step';

function parseDate(iso) { return new Date(iso + 'T00:00:00').getTime(); }
const ROADMAP_START_TS = parseDate(ROADMAP_START);
const ROADMAP_END_TS = parseDate(ROADMAP_END);
const ROADMAP_TOTAL_DAYS = Math.round((ROADMAP_END_TS - ROADMAP_START_TS) / 86400000);

const MILESTONES = [
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
];