"""VelocityCore — Flask backend.

Serves both pages, exposes a JSON API for blocks (internal) and milestones
(investor view). State lives in `data/blocks.json` and `data/milestones.json`,
created from embedded seeds on first run. Single-process, single-tenant —
this is the demo backend, not a production multi-user service.
"""
from __future__ import annotations

import json
import os
from datetime import date
from pathlib import Path
from threading import Lock

from flask import Flask, jsonify, request, send_from_directory

ROOT = Path(__file__).parent
DATA_DIR = ROOT / "data"
BLOCKS_PATH = DATA_DIR / "blocks.json"
MILESTONES_PATH = DATA_DIR / "milestones.json"

app = Flask(__name__, static_folder="static", static_url_path="/static")

_lock = Lock()


# --------------------------------------------------------------------------
# Persistence helpers
# --------------------------------------------------------------------------

def _load(path: Path):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def _save(path: Path, data) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2, ensure_ascii=False)
    tmp.replace(path)


# --------------------------------------------------------------------------
# Seed data — written to disk on first run if files don't exist
# --------------------------------------------------------------------------

SEED_BLOCKS = [
    {"id": 1, "name": "DLP Detection v2",
     "description": "Upgraded prompt injection detection. Improved recall +18% via contrastive learning on adversarial pairs. Targets direct and indirect injection vectors across open-source models.",
     "owner": "Dan", "due": "2026-05-07", "legs": ["runtime"], "sub": "Cyber",
     "type": "Engineering", "priority": "High", "complexity": "L",
     "milestones": ["Threat model done", "Prototype tested", "Merged to main"],
     "milestonesCompleted": [True, True, False],
     "progress": 65, "weight": 80, "weightSource": "ai", "blocked": False, "dependsOn": None},
    {"id": 2, "name": "AgentDojo Integration",
     "description": "Integration of AgentDojo benchmark to evaluate robustness of agentic pipelines. Covers multi-agent orchestration, tool misuse, and goal hijacking attack vectors.",
     "owner": "Lior", "due": "2026-05-07", "legs": ["runtime", "advisory"], "sub": "AI/Agentic",
     "type": "Research", "priority": "High", "complexity": "XL",
     "milestones": ["Env setup", "Attack scenarios mapped", "Eval complete"],
     "milestonesCompleted": [True, False, False],
     "progress": 55, "weight": 90, "weightSource": "ai", "blocked": False, "dependsOn": None},
    {"id": 3, "name": "vLLM Comprehensive Support",
     "description": "Full vLLM inference stack: streaming, batching, LoRA adapters, tensor parallelism. Core to open-source model monitoring strategy. Unblocks runtime monitoring for all HF-deployed models.",
     "owner": "Dan", "due": "2026-05-14", "legs": ["runtime"], "sub": "Technology",
     "type": "Engineering", "priority": "Medium", "complexity": "L",
     "milestones": ["API mapping", "Inference tests", "Docs written"],
     "milestonesCompleted": [True, False, False],
     "progress": 35, "weight": 70, "weightSource": "ai", "blocked": True, "dependsOn": None},
    {"id": 4, "name": "HF Model Eval Pipeline",
     "description": "Advisory UI pipeline that calls and evaluates leading HuggingFace model types. Auto-surfaces risk signals per model task to advisory customers.",
     "owner": "Natan", "due": "2026-05-07", "legs": ["advisory"], "sub": "UI",
     "type": "Engineering", "priority": "Medium", "complexity": "M",
     "milestones": ["Pipeline scaffold", "Model hooks", "UI integrated"],
     "milestonesCompleted": [True, True, False],
     "progress": 70, "weight": 65, "weightSource": "ai", "blocked": False, "dependsOn": 2},
    {"id": 5, "name": "Runtime Demo — DLP Scenario",
     "description": "End-to-end demo of DLP detection in a live LLM deployment. Shows attacker prompt, detection trigger, and mitigation. For investor and customer-facing presentations.",
     "owner": "Lior", "due": "2026-04-30", "legs": ["demo"], "sub": "Demo",
     "type": "Demo", "priority": "High", "complexity": "M",
     "milestones": ["Script ready", "Recorded"],
     "milestonesCompleted": [True, False],
     "progress": 60, "weight": 75, "weightSource": "ai", "blocked": False, "dependsOn": 1},
    {"id": 6, "name": "Agentic Attack Demo",
     "description": "Live demo of goal hijacking in a multi-agent pipeline using AgentDojo. Shows LuminAI detection and isolation in real time. Critical differentiator from model-only security tools.",
     "owner": "Natan", "due": "2026-04-30", "legs": ["demo", "runtime"], "sub": "Demo",
     "type": "Demo", "priority": "High", "complexity": "M",
     "milestones": ["Scenario defined", "Demo recorded"],
     "milestonesCompleted": [False, False],
     "progress": 55, "weight": 75, "weightSource": "ai", "blocked": False, "dependsOn": 2},
    {"id": 7, "name": "EU AI Act Article 13 Mapping",
     "description": "Mapping LuminAI runtime outputs to Article 13 transparency obligations. Documents what must be logged and disclosed for high-risk AI system classification under EU AI Act.",
     "owner": "Dan", "due": "2026-05-21", "legs": ["compliance"], "sub": "Framework",
     "type": "Research", "priority": "Low", "complexity": "S",
     "milestones": ["Scope defined", "Draft v1", "Review done"],
     "milestonesCompleted": [True, False, False],
     "progress": 20, "weight": 45, "weightSource": "ai", "blocked": False, "dependsOn": None},
]

SEED_MILESTONES = [
    {"id": 1,  "kpi": "runtime",    "name": "Initial DLP prototype",            "date": "2025-08-15", "completedDate": "2025-08-22", "weight": 1},
    {"id": 2,  "kpi": "runtime",    "name": "Threat-model framework v1",        "date": "2025-10-10", "completedDate": "2025-10-12", "weight": 1},
    {"id": 3,  "kpi": "runtime",    "name": "DLP detection v1 alpha",           "date": "2025-12-15", "completedDate": "2025-12-20", "weight": 1},
    {"id": 4,  "kpi": "runtime",    "name": "DLP v1 GA",                        "date": "2026-03-15", "completedDate": "2026-03-18", "weight": 1},
    {"id": 5,  "kpi": "runtime",    "name": "DLP v2 (contrastive learning)",    "date": "2026-04-15", "completedDate": "2026-04-20", "weight": 1},
    {"id": 6,  "kpi": "runtime",    "name": "vLLM streaming + batching",        "date": "2026-05-15", "completedDate": None,         "weight": 1},
    {"id": 7,  "kpi": "runtime",    "name": "vLLM LoRA + tensor parallel",      "date": "2026-06-15", "completedDate": None,         "weight": 1},
    {"id": 8,  "kpi": "runtime",    "name": "Multi-model runtime telemetry",    "date": "2026-07-30", "completedDate": None,         "weight": 1},

    {"id": 9,  "kpi": "compliance", "name": "EU AI Act framework analysis",     "date": "2025-09-20", "completedDate": "2025-10-05", "weight": 1},
    {"id": 10, "kpi": "compliance", "name": "Internal risk taxonomy v0.1",      "date": "2025-11-30", "completedDate": "2025-12-10", "weight": 1},
    {"id": 11, "kpi": "compliance", "name": "EU AI Act Article 9 mapping",      "date": "2026-03-30", "completedDate": "2026-04-02", "weight": 1},
    {"id": 12, "kpi": "compliance", "name": "EU AI Act Article 13 mapping",     "date": "2026-05-21", "completedDate": None,         "weight": 1},
    {"id": 13, "kpi": "compliance", "name": "Internal risk taxonomy v0.2",      "date": "2026-06-15", "completedDate": None,         "weight": 1},
    {"id": 14, "kpi": "compliance", "name": "SOC 2 readiness brief",            "date": "2026-08-15", "completedDate": None,         "weight": 1},

    {"id": 15, "kpi": "advisory",   "name": "Eval framework architecture",      "date": "2025-09-15", "completedDate": "2025-09-25", "weight": 1},
    {"id": 16, "kpi": "advisory",   "name": "HF API integration layer",         "date": "2025-11-20", "completedDate": "2025-11-28", "weight": 1},
    {"id": 17, "kpi": "advisory",   "name": "Vision pipeline scaffold",         "date": "2026-01-25", "completedDate": "2026-02-08", "weight": 1},
    {"id": 18, "kpi": "advisory",   "name": "HF Vision eval pipeline",          "date": "2026-03-25", "completedDate": "2026-04-01", "weight": 1},
    {"id": 19, "kpi": "advisory",   "name": "HF Tabular eval pipeline",         "date": "2026-04-30", "completedDate": "2026-04-25", "weight": 1},
    {"id": 20, "kpi": "advisory",   "name": "Model task evals (gen / NER / cls)", "date": "2026-05-30", "completedDate": None,       "weight": 1},
    {"id": 21, "kpi": "advisory",   "name": "Advisory UI integration",          "date": "2026-06-30", "completedDate": None,         "weight": 1},
    {"id": 22, "kpi": "advisory",   "name": "First customer pilot launch",      "date": "2026-08-15", "completedDate": None,         "weight": 2},

    {"id": 23, "kpi": "agenticai",  "name": "Agent attack literature review",   "date": "2025-09-10", "completedDate": "2025-09-22", "weight": 1},
    {"id": 24, "kpi": "agenticai",  "name": "Attack taxonomy v0",               "date": "2025-12-05", "completedDate": "2025-12-18", "weight": 1},
    {"id": 25, "kpi": "agenticai",  "name": "AgentDojo environment setup",      "date": "2026-03-20", "completedDate": "2026-03-22", "weight": 1},
    {"id": 26, "kpi": "agenticai",  "name": "Attack scenarios mapped",          "date": "2026-04-30", "completedDate": "2026-04-24", "weight": 1},
    {"id": 27, "kpi": "agenticai",  "name": "Multi-agent monitor prototype",    "date": "2026-05-25", "completedDate": None,         "weight": 1},
    {"id": 28, "kpi": "agenticai",  "name": "Goal-hijacking detection",         "date": "2026-07-01", "completedDate": None,         "weight": 2},
    {"id": 29, "kpi": "agenticai",  "name": "Agentic attack live demo",         "date": "2026-08-01", "completedDate": None,         "weight": 1},

    {"id": 30, "kpi": "hallucination", "name": "Hallucination detection v1",                   "date": "2026-05-15", "completedDate": "2026-05-15", "weight": 3},
    {"id": 31, "kpi": "hallucination", "name": "Hallucination eval benchmark",                 "date": "2026-06-30", "completedDate": None,         "weight": 4},
    {"id": 32, "kpi": "hallucination", "name": "Single-turn security integration",             "date": "2026-07-31", "completedDate": None,         "weight": 5},
    {"id": 33, "kpi": "hallucination", "name": "Unified hallucination + single-turn security", "date": "2026-08-31", "completedDate": None,         "weight": 8},

    {"id": 34, "kpi": "vllm", "name": "Qwen model support",              "date": "2026-04-15", "completedDate": "2026-04-15", "weight": 1},
    {"id": 35, "kpi": "vllm", "name": "NVIDIA Nemotron support",         "date": "2026-05-15", "completedDate": "2026-05-15", "weight": 1},
    {"id": 36, "kpi": "vllm", "name": "Full vLLM coverage (all models)", "date": "2026-08-31", "completedDate": None,         "weight": 3},

    {"id": 37, "kpi": "versatility", "name": "Multi-format input support",      "date": "2025-08-20", "completedDate": "2025-08-20", "weight": 3},
    {"id": 38, "kpi": "versatility", "name": "Multi-task evaluation modes",     "date": "2025-11-15", "completedDate": "2025-11-15", "weight": 2},
    {"id": 39, "kpi": "versatility", "name": "Cross-modal coverage",            "date": "2026-02-15", "completedDate": "2026-02-15", "weight": 1},
    {"id": 40, "kpi": "versatility", "name": "Custom workflow adapters",        "date": "2026-05-20", "completedDate": "2026-05-20", "weight": 1},
    {"id": 41, "kpi": "versatility", "name": "Plug-in extensibility framework", "date": "2026-07-15", "completedDate": None,         "weight": 6},
    {"id": 42, "kpi": "versatility", "name": "Full versatility coverage",       "date": "2026-08-31", "completedDate": None,         "weight": 7},

    {"id": 43, "kpi": "multirule", "name": "20 rules/prompt @ 0.92 ms",         "date": "2026-04-15", "completedDate": "2026-04-15", "weight": 5},
    {"id": 44, "kpi": "multirule", "name": "20 rules/prompt @ 0.0155 ms",       "date": "2026-06-20", "completedDate": "2026-06-20", "weight": 15},
    {"id": 45, "kpi": "multirule", "name": "Full multi-rule parallel coverage", "date": "2026-08-31", "completedDate": None,         "weight": 80},
]


def ensure_data_files() -> None:
    DATA_DIR.mkdir(exist_ok=True)
    if not BLOCKS_PATH.exists():
        _save(BLOCKS_PATH, SEED_BLOCKS)
    if not MILESTONES_PATH.exists():
        _save(MILESTONES_PATH, SEED_MILESTONES)


# --------------------------------------------------------------------------
# Page routes
# --------------------------------------------------------------------------

@app.route("/")
def home():
    return send_from_directory(ROOT, "index.html")


@app.route("/<path:filename>")
def asset(filename: str):
    if filename.startswith("data/") or filename in {"app.py", "pyproject.toml", "uv.lock"}:
        return ("forbidden", 403)
    return send_from_directory(ROOT, filename)


# --------------------------------------------------------------------------
# Blocks API
# --------------------------------------------------------------------------

@app.route("/api/blocks", methods=["GET"])
def list_blocks():
    return jsonify(_load(BLOCKS_PATH))


@app.route("/api/blocks/<int:block_id>", methods=["PUT"])
def update_block(block_id: int):
    body = request.get_json(silent=True) or {}
    with _lock:
        blocks = _load(BLOCKS_PATH)
        block = next((b for b in blocks if b["id"] == block_id), None)
        if block is None:
            return jsonify({"error": "block not found"}), 404
        for key in ("progress", "weight", "blocked", "name", "description"):
            if key in body:
                block[key] = body[key]
        _save(BLOCKS_PATH, blocks)
        return jsonify(block)


# --------------------------------------------------------------------------
# Milestones API
# --------------------------------------------------------------------------

VALID_KPIS = {"runtime", "compliance", "advisory", "agenticai", "hallucination", "vllm", "versatility"}


def _validate_milestone(body: dict, *, partial: bool = False) -> tuple[str | None, dict]:
    if not partial:
        for required in ("kpi", "name", "date"):
            if required not in body:
                return f"missing required field: {required}", {}
    cleaned = {}
    if "kpi" in body:
        if body["kpi"] not in VALID_KPIS:
            return f"invalid kpi: {body['kpi']}", {}
        cleaned["kpi"] = body["kpi"]
    if "name" in body:
        name = str(body["name"]).strip()
        if not name:
            return "name is required", {}
        cleaned["name"] = name[:120]
    if "date" in body:
        cleaned["date"] = body["date"]
    if "completedDate" in body:
        cleaned["completedDate"] = body["completedDate"] or None
    if "weight" in body:
        try:
            cleaned["weight"] = max(1, int(body["weight"]))
        except (TypeError, ValueError):
            return "weight must be an integer", {}
    return None, cleaned


@app.route("/api/milestones", methods=["GET"])
def list_milestones():
    return jsonify(_load(MILESTONES_PATH))


@app.route("/api/milestones", methods=["POST"])
def create_milestone():
    error, cleaned = _validate_milestone(request.get_json(silent=True) or {})
    if error:
        return jsonify({"error": error}), 400
    with _lock:
        ms = _load(MILESTONES_PATH)
        next_id = max((m["id"] for m in ms), default=0) + 1
        new_ms = {
            "id": next_id,
            "kpi": cleaned["kpi"],
            "name": cleaned["name"],
            "date": cleaned["date"],
            "completedDate": cleaned.get("completedDate"),
            "weight": cleaned.get("weight", 1),
        }
        ms.append(new_ms)
        _save(MILESTONES_PATH, ms)
        return jsonify(new_ms), 201


@app.route("/api/milestones/<int:ms_id>", methods=["PUT"])
def update_milestone(ms_id: int):
    error, cleaned = _validate_milestone(request.get_json(silent=True) or {}, partial=True)
    if error:
        return jsonify({"error": error}), 400
    with _lock:
        ms_list = _load(MILESTONES_PATH)
        m = next((x for x in ms_list if x["id"] == ms_id), None)
        if m is None:
            return jsonify({"error": "milestone not found"}), 404
        m.update(cleaned)
        _save(MILESTONES_PATH, ms_list)
        return jsonify(m)


@app.route("/api/milestones/<int:ms_id>/ship", methods=["POST"])
def ship_milestone(ms_id: int):
    body = request.get_json(silent=True) or {}
    with _lock:
        ms_list = _load(MILESTONES_PATH)
        m = next((x for x in ms_list if x["id"] == ms_id), None)
        if m is None:
            return jsonify({"error": "milestone not found"}), 404
        if m.get("_savedDate"):
            m["completedDate"] = m["_savedDate"]
            del m["_savedDate"]
        else:
            m["completedDate"] = body.get("date") or date.today().isoformat()
        _save(MILESTONES_PATH, ms_list)
        return jsonify(m)


@app.route("/api/milestones/<int:ms_id>/unship", methods=["POST"])
def unship_milestone(ms_id: int):
    with _lock:
        ms_list = _load(MILESTONES_PATH)
        m = next((x for x in ms_list if x["id"] == ms_id), None)
        if m is None:
            return jsonify({"error": "milestone not found"}), 404
        if m.get("completedDate"):
            m["_savedDate"] = m["completedDate"]
            m["completedDate"] = None
        _save(MILESTONES_PATH, ms_list)
        return jsonify(m)


@app.route("/api/milestones/<int:ms_id>", methods=["DELETE"])
def delete_milestone(ms_id: int):
    with _lock:
        ms_list = _load(MILESTONES_PATH)
        before = len(ms_list)
        ms_list = [x for x in ms_list if x["id"] != ms_id]
        if len(ms_list) == before:
            return jsonify({"error": "milestone not found"}), 404
        _save(MILESTONES_PATH, ms_list)
        return ("", 204)


# --------------------------------------------------------------------------
# Entrypoint
# --------------------------------------------------------------------------

def _link(url: str, text: str | None = None) -> str:
    """Wrap URL in OSC 8 escape so modern terminals render it as a clickable link."""
    import sys
    label = text or url
    if not sys.stdout.isatty():
        return label
    return f"\x1b]8;;{url}\x1b\\{label}\x1b]8;;\x1b\\"


def _print_banner(host: str, port: int) -> None:
    base = f"http://{host}:{port}"
    home = base + "/"
    investors = base + "/investors.html"
    print()
    print("  ━━━  LuminAI VelocityCore  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print()
    print(f"    Internal (sprint KPIs)              {_link(home)}")
    print(f"    Strategic Velocity (investor view)  {_link(investors)}")
    print()
    print("  Press CTRL+C to stop.  State persists in data/*.json.")
    print("  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    print()


if __name__ == "__main__":
    ensure_data_files()
    HOST = "127.0.0.1"
    PORT = 5173
    # WERKZEUG_RUN_MAIN is set by the reloader's child process; print only once.
    if os.environ.get("WERKZEUG_RUN_MAIN") != "true":
        _print_banner(HOST, PORT)
    app.run(host=HOST, port=PORT, debug=True)
