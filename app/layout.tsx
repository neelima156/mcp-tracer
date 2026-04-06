import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MCP Tool Call Tracer — Visualize Agentic AI Pipelines",
  description:
    "Live visualization of MCP tool call chains: sequential vs parallel vs dependency-aware execution. See how execution mode affects latency in agentic AI systems.",
  openGraph: {
    title: "MCP Tool Call Tracer",
    description: "Visualize how AI agents orchestrate tool calls. By Neelima V.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
