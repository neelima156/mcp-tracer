"use client";

import { useState, useCallback, useRef } from "react";
import { SCENARIOS } from "@/lib/scenarios";
import { executeTrace } from "@/lib/executor";
import type { ToolCall, ExecMode, TraceRun } from "@/lib/types";
import styles from "./MCPTracer.module.css";

/* ─── constants ─── */
const MODE_META: Record<ExecMode, { label: string; color: string; caption: string }> = {
  sequential: { label: "Sequential",  color: "var(--mode-seq)", caption: "One tool at a time — safe but slow" },
  parallel:   { label: "Parallel",    color: "var(--mode-par)", caption: "All tools fire at once — fast but ignores dependencies" },
  dependency: { label: "Dependency-aware", color: "var(--mode-dep)", caption: "Tools fire in topological waves — optimal" },
};

const CAT_COLOR: Record<string, string> = {
  data:     "var(--cat-data)",
  compute:  "var(--cat-compute)",
  external: "var(--cat-external)",
  write:    "var(--cat-write)",
};

/* ─── sub-components ─── */

function StatusDot({ status }: { status: ToolCall["status"] }) {
  return (
    <span
      className={styles.dot}
      style={{
        background: `var(--${status}-dot)`,
        animation: status === "running" ? "pulse-dot 1s ease-in-out infinite" : "none",
      }}
    />
  );
}

function ToolRow({ call, maxMs, scenarioTool }: {
  call: ToolCall;
  maxMs: number;
  scenarioTool?: { category: string; dependsOn: string[] };
}) {
  const pct = call.durationMs && maxMs ? Math.min(100, (call.durationMs / maxMs) * 100) : 0;
  const catColor = CAT_COLOR[scenarioTool?.category ?? "data"];

  return (
    <div className={styles.toolRow} style={{ animation: "slide-in 0.18s ease both" }}>
      <div className={styles.toolLeft}>
        <StatusDot status={call.status} />
        <span className={styles.toolName} style={{ color: catColor }}>
          {call.name}
        </span>
        {scenarioTool && scenarioTool.dependsOn.length > 0 && (
          <span className={styles.depChip}>
            needs {scenarioTool.dependsOn.map((d) => d.replace(/_/g, " ")).join(", ")}
          </span>
        )}
      </div>
      <div className={styles.toolRight}>
        <div className={styles.barTrack}>
          {call.status === "running" && (
            <div
              className={styles.barRunning}
              style={{ background: catColor, animation: "fill-bar 1.2s linear forwards" }}
            />
          )}
          {call.status === "done" && (
            <div
              className={styles.barDone}
              style={{ width: `${pct}%`, background: catColor, opacity: 0.55 }}
            />
          )}
        </div>
        <span className={`${styles.toolMs} ${styles.mono}`} style={{ color: call.durationMs ? catColor : "var(--text-tertiary)" }}>
          {call.durationMs ? `${call.durationMs}ms` : call.status === "running" ? "···" : "—"}
        </span>
      </div>
    </div>
  );
}

function WaveGroup({ layer, calls, maxMs, scenario }: {
  layer: number;
  calls: ToolCall[];
  maxMs: number;
  scenario: typeof SCENARIOS[0];
}) {
  const labels = ["Wave 1 — independent tools", "Wave 2 — first dependencies resolved", "Wave 3 — final synthesis"];
  return (
    <div className={styles.waveGroup}>
      <div className={styles.waveLabel}>{labels[layer] ?? `Wave ${layer + 1}`}</div>
      {calls.map((c) => (
        <ToolRow
          key={c.id}
          call={c}
          maxMs={maxMs}
          scenarioTool={scenario.tools.find((t) => t.id === c.toolId)}
        />
      ))}
    </div>
  );
}

function CompareBar({ runs }: { runs: TraceRun[] }) {
  if (runs.length === 0) return null;
  const maxMs = Math.max(...runs.map((r) => r.totalMs ?? 0));

  return (
    <div className={styles.compareCard}>
      <div className={styles.compareTitle}>Execution comparison</div>
      {runs.map((r) => {
        const meta = MODE_META[r.mode];
        const pct = r.totalMs ? Math.round((r.totalMs / maxMs) * 100) : 0;
        return (
          <div key={r.id} className={styles.compareRow}>
            <div className={styles.compareRowLabel}>
              <span style={{ color: meta.color, fontSize: 12, fontWeight: 500 }}>{meta.label}</span>
              <span className={`${styles.mono}`} style={{ color: meta.color, fontSize: 12 }}>
                {r.totalMs}ms
              </span>
            </div>
            <div className={styles.compareTrack}>
              <div
                className={styles.compareFill}
                style={{ width: `${pct}%`, background: meta.color, opacity: 0.4 }}
              />
            </div>
          </div>
        );
      })}
      {runs.length === 3 && (
        <div className={styles.compareInsight}>
          Dependency-aware saves{" "}
          <strong style={{ color: "var(--mode-dep)" }}>
            {(runs.find((r) => r.mode === "sequential")?.totalMs ?? 0) -
              (runs.find((r) => r.mode === "dependency")?.totalMs ?? 0)}ms
          </strong>{" "}
          vs sequential — without the correctness risk of pure parallel execution.
        </div>
      )}
    </div>
  );
}

/* ─── main ─── */
export default function MCPTracer() {
  const [scenarioId, setScenarioId]   = useState(SCENARIOS[0].id);
  const [mode, setMode]               = useState<ExecMode>("sequential");
  const [running, setRunning]         = useState(false);
  const [calls, setCalls]             = useState<ToolCall[]>([]);
  const [totalMs, setTotalMs]         = useState<number | null>(null);
  const [llmSummary, setLlmSummary]   = useState<string | null>(null);
  const [llmMs, setLlmMs]             = useState<number | null>(null);
  const [history, setHistory]         = useState<TraceRun[]>([]);
  const runId = useRef(0);

  const scenario = SCENARIOS.find((s) => s.id === scenarioId)!;

  const handleRun = useCallback(async () => {
    runId.current += 1;
    const myRun = runId.current;

    setRunning(true);
    setCalls([]);
    setTotalMs(null);
    setLlmSummary(null);
    setLlmMs(null);

    const { calls: finalCalls, totalMs: ms } = await executeTrace(
      scenario.tools,
      mode,
      (updated) => { if (runId.current === myRun) setCalls([...updated]); }
    );

    if (runId.current !== myRun) return;
    setTotalMs(ms);

    // LLM summary
    const lt = performance.now();
    try {
      const res = await fetch("/api/trace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId, mode, calls: finalCalls, totalMs: ms }),
      });
      const { summary } = await res.json();
      if (runId.current === myRun) {
        setLlmSummary(summary);
        setLlmMs(Math.round(performance.now() - lt));
      }
    } catch {
      setLlmSummary(null);
    }

    // Add to history
    const run: TraceRun = {
      id: `run-${myRun}`,
      scenarioId,
      mode,
      startedAt: Date.now() - ms,
      completedAt: Date.now(),
      calls: finalCalls,
      llmSummary: null,
      llmMs: null,
      totalMs: ms,
    };
    setHistory((prev) => {
      const filtered = prev.filter((r) => r.scenarioId !== scenarioId || r.mode !== mode);
      return [...filtered, run].slice(-9);
    });

    setRunning(false);
  }, [scenario, mode, scenarioId]);

  // Group calls by layer for dependency mode
  const maxMs = Math.max(...calls.map((c) => c.durationMs ?? 0), 1);
  const layers = [...new Set(calls.map((c) => c.layer))].sort();
  const callsByLayer = Object.fromEntries(
    layers.map((l) => [l, calls.filter((c) => c.layer === l)])
  );

  const runsForScenario = history.filter((r) => r.scenarioId === scenarioId);

  return (
    <div className={styles.page}>

      {/* ── sidebar ── */}
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <span className={styles.logoMark}>MCP</span>
          <span className={styles.logoSub}>tool call tracer</span>
        </div>

        <div className={styles.sideSection}>
          <div className={styles.sideLabel}>Scenario</div>
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              className={`${styles.sideBtn} ${scenarioId === s.id ? styles.sideBtnActive : ""}`}
              onClick={() => { setScenarioId(s.id); setCalls([]); setTotalMs(null); setLlmSummary(null); }}
            >
              <span className={styles.sideBtnTitle}>{s.title}</span>
              <span className={styles.sideBtnDesc}>{s.description}</span>
            </button>
          ))}
        </div>

        <div className={styles.sideSection}>
          <div className={styles.sideLabel}>Execution mode</div>
          {(Object.entries(MODE_META) as [ExecMode, typeof MODE_META[ExecMode]][]).map(([m, meta]) => (
            <button
              key={m}
              className={`${styles.modeBtn} ${mode === m ? styles.modeBtnActive : ""}`}
              style={mode === m ? { borderColor: meta.color, color: meta.color } : {}}
              onClick={() => setMode(m)}
            >
              <span className={styles.modeBtnLabel}>{meta.label}</span>
              <span className={styles.modeBtnCaption}>{meta.caption}</span>
            </button>
          ))}
        </div>

        <div className={styles.sideLegend}>
          <div className={styles.sideLabel}>Tool categories</div>
          {[
            ["data",     "Data fetch"],
            ["compute",  "Compute"],
            ["external", "External API"],
            ["write",    "Write / generate"],
          ].map(([cat, label]) => (
            <div key={cat} className={styles.legendRow}>
              <span className={styles.legendDot} style={{ background: CAT_COLOR[cat] }} />
              <span className={styles.legendLabel}>{label}</span>
            </div>
          ))}
        </div>

        <div className={styles.sideFooter}>
          Built by{" "}
          <a href="https://github.com/neelima156" target="_blank" rel="noreferrer" className={styles.footerLink}>
            Neelima V
          </a>
          <br />
          <a href="https://pa-latency-lab.vercel.app" target="_blank" rel="noreferrer" className={styles.footerLink}>
            → PA Latency Lab
          </a>
        </div>
      </aside>

      {/* ── main ── */}
      <main className={styles.main}>

        {/* header */}
        <div className={styles.mainHeader}>
          <div>
            <h1 className={styles.mainTitle}>{scenario.title}</h1>
            <p className={styles.mainPrompt}>&ldquo;{scenario.userPrompt}&rdquo;</p>
          </div>
          <button
            className={styles.runBtn}
            onClick={handleRun}
            disabled={running}
            style={{ borderColor: MODE_META[mode].color, color: MODE_META[mode].color }}
          >
            {running ? "Tracing…" : `Run ${MODE_META[mode].label}`}
          </button>
        </div>

        {/* tool count + mode badge */}
        <div className={styles.metaRow}>
          <span className={styles.metaBadge}>{scenario.tools.length} tools</span>
          <span
            className={styles.modePill}
            style={{ background: `${MODE_META[mode].color}18`, color: MODE_META[mode].color, borderColor: `${MODE_META[mode].color}40` }}
          >
            {MODE_META[mode].label}
          </span>
          {totalMs && (
            <span className={`${styles.totalMs} ${styles.mono}`} style={{ color: MODE_META[mode].color }}>
              {totalMs}ms total
            </span>
          )}
        </div>

        {/* trace panel */}
        {calls.length > 0 && (
          <div className={styles.tracePanel}>
            {mode === "dependency"
              ? layers.map((l) => (
                  <WaveGroup
                    key={l}
                    layer={l}
                    calls={callsByLayer[l]}
                    maxMs={maxMs}
                    scenario={scenario}
                  />
                ))
              : calls.map((c) => (
                  <ToolRow
                    key={c.id}
                    call={c}
                    maxMs={maxMs}
                    scenarioTool={scenario.tools.find((t) => t.id === c.toolId)}
                  />
                ))
            }
          </div>
        )}

        {/* LLM analysis */}
        {llmSummary && (
          <div className={styles.summaryCard}>
            <div className={styles.summaryMeta}>
              AI architectural analysis · {llmMs}ms · Claude claude-sonnet-4-20250514
            </div>
            <p className={styles.summaryText}>{llmSummary}</p>
          </div>
        )}

        {/* comparison across runs */}
        {runsForScenario.length > 1 && <CompareBar runs={runsForScenario} />}

        {/* empty state */}
        {calls.length === 0 && !running && (
          <div className={styles.empty}>
            <div className={styles.emptyTitle}>Choose a mode and run the trace</div>
            <div className={styles.emptyBody}>
              Run all three modes to compare how execution strategy affects total latency.
              Dependency-aware execution is the core insight behind efficient MCP pipelines.
            </div>
            <div className={styles.emptyTools}>
              {scenario.tools.map((t) => (
                <div key={t.id} className={styles.emptyTool}>
                  <span className={styles.emptyDot} style={{ background: CAT_COLOR[t.category] }} />
                  <span className={styles.emptyToolName}>{t.name.replace(/_/g, " ")}</span>
                  {t.dependsOn.length > 0 && (
                    <span className={styles.emptyDep}>
                      depends on {t.dependsOn.length} tool{t.dependsOn.length > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
