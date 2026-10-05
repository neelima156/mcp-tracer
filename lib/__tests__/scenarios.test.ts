import { describe, it, expect } from "vitest";
import { SCENARIOS } from "../scenarios";

describe("scenario definitions", () => {
  it("has at least one scenario", () => {
    expect(SCENARIOS.length).toBeGreaterThan(0);
  });

  for (const scenario of SCENARIOS) {
    describe(scenario.id, () => {
      const ids = scenario.tools.map((t) => t.id);

      it("uses unique tool ids", () => {
        expect(new Set(ids).size).toBe(ids.length);
      });

      it("only depends on tools that exist in the same scenario", () => {
        for (const tool of scenario.tools) {
          for (const dep of tool.dependsOn) {
            expect(ids, `${tool.id} depends on unknown tool ${dep}`).toContain(dep);
          }
        }
      });

      it("has no circular dependencies", () => {
        const placed = new Set<string>();
        let remaining = [...scenario.tools];
        while (remaining.length > 0) {
          const wave = remaining.filter((t) => t.dependsOn.every((d) => placed.has(d)));
          expect(wave.length, "dependency cycle detected").toBeGreaterThan(0);
          wave.forEach((t) => placed.add(t.id));
          remaining = remaining.filter((t) => !placed.has(t.id));
        }
      });
    });
  }
});
