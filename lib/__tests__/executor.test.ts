import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { executeTrace } from "../executor";
import type { ToolNode } from "../types";

const tool = (id: string, dependsOn: string[] = [], simulatedMs = 100): ToolNode => ({
  id,
  name: id,
  description: `${id} (test)`,
  category: "data",
  dependsOn,
  simulatedMs,
});

// a and b are independent; c needs both; d needs c
const TOOLS: ToolNode[] = [tool("a"), tool("b"), tool("c", ["a", "b"]), tool("d", ["c"])];

async function run(tools: ToolNode[], mode: "sequential" | "parallel" | "dependency") {
  const updates: number[] = [];
  const promise = executeTrace(tools, mode, (calls) => updates.push(calls.length));
  await vi.runAllTimersAsync();
  const result = await promise;
  return { ...result, updates };
}

describe("executeTrace", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("sequential mode runs every tool, one layer each, in order", async () => {
    const { calls } = await run(TOOLS, "sequential");
    expect(calls.map((c) => c.status)).toEqual(["done", "done", "done", "done"]);
    expect(calls.map((c) => c.layer)).toEqual([0, 1, 2, 3]);
  });

  it("parallel mode puts every tool in the first layer", async () => {
    const { calls } = await run(TOOLS, "parallel");
    expect(calls.every((c) => c.status === "done")).toBe(true);
    expect(calls.every((c) => c.layer === 0)).toBe(true);
  });

  it("dependency mode schedules tools in waves that respect dependsOn", async () => {
    const { calls } = await run(TOOLS, "dependency");
    const layer = Object.fromEntries(calls.map((c) => [c.toolId, c.layer]));
    expect(layer).toEqual({ a: 0, b: 0, c: 1, d: 2 });
    expect(calls.every((c) => c.status === "done")).toBe(true);
  });

  it("dependency mode starts a tool only after its dependencies complete", async () => {
    const { calls } = await run(TOOLS, "dependency");
    const byId = Object.fromEntries(calls.map((c) => [c.toolId, c]));
    for (const t of TOOLS) {
      for (const dep of t.dependsOn) {
        expect(byId[t.id].startedAt!).toBeGreaterThanOrEqual(byId[dep].completedAt!);
      }
    }
  });

  it("dependency mode does not hang on a dependency cycle", async () => {
    const cyclic = [tool("x", ["y"]), tool("y", ["x"]), tool("ok")];
    const { calls } = await run(cyclic, "dependency");
    const status = Object.fromEntries(calls.map((c) => [c.toolId, c.status]));
    expect(status.ok).toBe("done");
    expect(status.x).toBe("pending");
    expect(status.y).toBe("pending");
  });

  it("streams state updates to the UI callback", async () => {
    const { updates } = await run(TOOLS, "dependency");
    expect(updates.length).toBeGreaterThan(TOOLS.length);
  });
});
