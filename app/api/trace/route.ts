import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { SCENARIO_MAP } from "@/lib/scenarios";
import type { ToolCall, ExecMode } from "@/lib/types";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface SummaryRequest {
  scenarioId: string;
  mode: ExecMode;
  calls: ToolCall[];
  totalMs: number;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as SummaryRequest;
  const { scenarioId, mode, calls, totalMs } = body;
  const scenario = SCENARIO_MAP[scenarioId];

  if (!scenario) return NextResponse.json({ summary: "Unknown scenario." });

  const toolSummary = calls
    .map((c) => `- ${c.name}: ${c.durationMs ?? "—"}ms (${c.status})`)
    .join("\n");

  const prompt = `You are an AI architecture analyst. Provide a 2-3 sentence plain-English summary of this MCP agent trace. Be specific about what the numbers mean architecturally. No markdown, no bullet points — just flowing prose.

Scenario: ${scenario.title}
Execution mode: ${mode}
Total time: ${totalMs}ms
Tool calls:
${toolSummary}

Focus on: what the execution pattern reveals about the architecture, and one concrete improvement if relevant.`;

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 200,
      messages: [{ role: "user", content: prompt }],
    });

    const summary = message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");

    return NextResponse.json({ summary: summary.trim() });
  } catch (err) {
    console.error("Trace summary error:", err);
    return NextResponse.json({
      summary: `${mode} execution completed ${calls.length} tool calls in ${totalMs}ms. The dependency-aware mode fires independent tools in parallel waves, matching the pattern used in high-volume FX systems where lock-free concurrent data structures replaced sequential lookups.`,
    });
  }
}
