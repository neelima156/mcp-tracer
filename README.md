# MCP Tool Call Tracer

**Live visualizer for MCP (Model Context Protocol) tool call chains.**

By [Neelima V](https://github.com/neelima156) · Companion to the whiteboarding video series on MCP architecture.

→ **[PA Latency Lab](https://pa-latency-lab.vercel.app)** — related demo on healthcare AI latency

---

## What this shows

Three execution strategies for agentic AI tool calls, visualized in real time:

| Mode | Description | When to use |
|---|---|---|
| Sequential | One tool at a time | When each tool depends on the previous |
| Parallel | All tools fire simultaneously | When tools are fully independent |
| Dependency-aware | Topological wave execution | **Best practice** — fires tools as soon as their dependencies resolve |

The dependency-aware mode is the core insight behind efficient MCP pipelines — it's the same pattern as lock-free concurrent data structures in high-volume Java systems.

---

## Scenarios

1. **Prior authorization check** — healthcare AI agent with patient history, formulary, coverage, and drug interaction tools
2. **Architecture review agent** — codebase analysis with trace data, metrics, and ADR generation
3. **Incident response agent** — production triage with log correlation and root cause analysis

Each scenario has real dependency graphs — some tools must wait for others, some can fire in parallel.

---

## Local setup

```bash
git clone https://github.com/neelima156/mcp-tracer
cd mcp-tracer
npm install

cp .env.local.example .env.local
# Add your ANTHROPIC_API_KEY

npm run dev
```

---

## Deploy to Vercel

```bash
git push origin main
# Import on vercel.com → add ANTHROPIC_API_KEY env var → deploy
```

---

## Structure

```
mcp-tracer/
├── app/
│   ├── api/trace/route.ts     # Server-side LLM analysis (key stays private)
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── MCPTracer.tsx          # Full interactive tracer UI
│   └── MCPTracer.module.css
└── lib/
    ├── executor.ts            # Sequential / parallel / dependency execution logic
    ├── scenarios.ts           # Three scenarios with tool dependency graphs
    └── types.ts
```

---

## The whiteboarding video connection

This tool is designed to be demoed live during a whiteboarding video on MCP architecture. The three execution modes map directly to the three sections of the video:

1. **Draw the problem** → show sequential mode, point at the waterfall
2. **Explain MCP tool use** → show parallel mode, explain why pure parallel breaks with dependencies  
3. **The real solution** → show dependency-aware mode, explain topological wave execution

The comparison panel builds automatically as you run all three modes — giving you a live side-by-side at the end of the demo.
