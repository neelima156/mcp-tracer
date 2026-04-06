import type { ToolNode, ToolCall, ExecMode } from "./types";

function jitter(base: number) {
  return Math.round(base * (0.85 + Math.random() * 0.3));
}

function makeCall(tool: ToolNode, layer: number): ToolCall {
  return {
    id: `${tool.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    toolId: tool.id,
    name: tool.name,
    status: "pending",
    startedAt: null,
    completedAt: null,
    durationMs: null,
    input: { tool: tool.id },
    output: null,
    error: null,
    layer,
  };
}

// Callback fired on every state change so the UI can stream updates
export type OnUpdate = (calls: ToolCall[]) => void;

export async function executeTrace(
  tools: ToolNode[],
  mode: ExecMode,
  onUpdate: OnUpdate
): Promise<{ calls: ToolCall[]; totalMs: number }> {
  const start = performance.now();

  if (mode === "sequential") {
    return runSequential(tools, onUpdate, start);
  } else if (mode === "parallel") {
    return runParallel(tools, onUpdate, start);
  } else {
    return runDependency(tools, onUpdate, start);
  }
}

/* ── Sequential: one at a time ── */
async function runSequential(
  tools: ToolNode[],
  onUpdate: OnUpdate,
  start: number
): Promise<{ calls: ToolCall[]; totalMs: number }> {
  const calls: ToolCall[] = tools.map((t, i) => makeCall(t, i));
  onUpdate([...calls]);

  for (let i = 0; i < tools.length; i++) {
    calls[i] = { ...calls[i], status: "running", startedAt: performance.now() };
    onUpdate([...calls]);

    const ms = jitter(tools[i].simulatedMs);
    await new Promise((r) => setTimeout(r, ms));

    calls[i] = {
      ...calls[i],
      status: "done",
      completedAt: performance.now(),
      durationMs: ms,
      output: `Mock result from ${tools[i].name}`,
    };
    onUpdate([...calls]);
  }

  return { calls, totalMs: Math.round(performance.now() - start) };
}

/* ── Parallel: all at once ── */
async function runParallel(
  tools: ToolNode[],
  onUpdate: OnUpdate,
  start: number
): Promise<{ calls: ToolCall[]; totalMs: number }> {
  const calls: ToolCall[] = tools.map((t) => makeCall(t, 0));
  onUpdate([...calls]);

  await Promise.all(
    tools.map(async (t, i) => {
      calls[i] = { ...calls[i], status: "running", startedAt: performance.now() };
      onUpdate([...calls]);

      const ms = jitter(t.simulatedMs);
      await new Promise((r) => setTimeout(r, ms));

      calls[i] = {
        ...calls[i],
        status: "done",
        completedAt: performance.now(),
        durationMs: ms,
        output: `Mock result from ${t.name}`,
      };
      onUpdate([...calls]);
    })
  );

  return { calls, totalMs: Math.round(performance.now() - start) };
}

/* ── Dependency-aware: topological wave execution ── */
async function runDependency(
  tools: ToolNode[],
  onUpdate: OnUpdate,
  start: number
): Promise<{ calls: ToolCall[]; totalMs: number }> {
  // Build waves (topological layers)
  const layers: ToolNode[][] = [];
  const placed = new Set<string>();

  let remaining = [...tools];
  while (remaining.length > 0) {
    const wave = remaining.filter((t) =>
      t.dependsOn.every((dep) => placed.has(dep))
    );
    if (wave.length === 0) break; // cycle guard
    layers.push(wave);
    wave.forEach((t) => placed.add(t.id));
    remaining = remaining.filter((t) => !placed.has(t.id));
  }

  const allCalls: ToolCall[] = tools.map((t, layerIdx) => {
    const layer = layers.findIndex((l) => l.some((lt) => lt.id === t.id));
    return makeCall(t, layer >= 0 ? layer : layerIdx);
  });
  onUpdate([...allCalls]);

  for (let li = 0; li < layers.length; li++) {
    const wave = layers[li];
    await Promise.all(
      wave.map(async (t) => {
        const idx = allCalls.findIndex((c) => c.toolId === t.id);
        allCalls[idx] = { ...allCalls[idx], status: "running", startedAt: performance.now() };
        onUpdate([...allCalls]);

        const ms = jitter(t.simulatedMs);
        await new Promise((r) => setTimeout(r, ms));

        allCalls[idx] = {
          ...allCalls[idx],
          status: "done",
          completedAt: performance.now(),
          durationMs: ms,
          output: `Mock result from ${t.name}`,
        };
        onUpdate([...allCalls]);
      })
    );
  }

  return { calls: allCalls, totalMs: Math.round(performance.now() - start) };
}
