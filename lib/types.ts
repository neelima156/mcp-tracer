export type ToolStatus = "pending" | "running" | "done" | "error";
export type ExecMode  = "sequential" | "parallel" | "dependency";

export interface ToolNode {
  id: string;
  name: string;
  description: string;
  category: "data" | "compute" | "external" | "write";
  dependsOn: string[];          // other tool ids that must complete first
  simulatedMs: number;          // base mock latency
}

export interface ToolCall {
  id: string;
  toolId: string;
  name: string;
  status: ToolStatus;
  startedAt: number | null;
  completedAt: number | null;
  durationMs: number | null;
  input: Record<string, unknown>;
  output: string | null;
  error: string | null;
  layer: number;                // 0 = first wave, 1 = second wave, etc.
}

export interface TraceRun {
  id: string;
  scenarioId: string;
  mode: ExecMode;
  startedAt: number;
  completedAt: number | null;
  calls: ToolCall[];
  llmSummary: string | null;
  llmMs: number | null;
  totalMs: number | null;
}

export interface Scenario {
  id: string;
  title: string;
  description: string;
  userPrompt: string;
  tools: ToolNode[];
}

export interface TraceRequest {
  scenarioId: string;
  mode: ExecMode;
}
