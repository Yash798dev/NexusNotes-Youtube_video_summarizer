"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { TimelineEvent } from "@/app/dashboard/[videoId]/page";

interface Props {
  markdown: string;
  timeline: TimelineEvent[];
  onSeek: (seconds: number) => void;
}

function parseTimeStr(str: string): number {
  const [h, m, s] = str.split(":").map(Number);
  return h * 3600 + m * 60 + s;
}

// ── Timeline accordion ────────────────────────────────────────────────────────
function TimelineAccordion({ timeline, onSeek }: { timeline: TimelineEvent[]; onSeek: (s: number) => void }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "speech" | "visual">("all");

  const speech = timeline.filter((e) => e.type === "speech");
  const visual = timeline.filter((e) => e.type === "visual");
  const filtered = filter === "all" ? timeline : filter === "speech" ? speech : visual;

  return (
    <div
      style={{
        borderRadius: 14,
        border: "1px solid var(--border-glass)",
        background: "rgba(255,255,255,0.02)",
        overflow: "hidden",
      }}
    >
      {/* Header / toggle */}
      <button
        id="timeline-toggle"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.85rem 1.1rem",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          gap: "0.75rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <span style={{ fontSize: "1rem" }}>📍</span>
          <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--text-secondary)" }}>
            Timeline
          </span>
          <span
            style={{
              background: "rgba(124,58,237,0.15)",
              border: "1px solid rgba(124,58,237,0.3)",
              borderRadius: 99,
              padding: "0.1rem 0.55rem",
              fontSize: "0.7rem",
              color: "#a78bfa",
              fontWeight: 600,
            }}
          >
            {timeline.length} events
          </span>
          <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
            🎙 {speech.length} speech &nbsp;·&nbsp; 👁 {visual.length} visual
          </span>
        </div>
        <span
          style={{
            color: "var(--text-muted)",
            fontSize: "0.8rem",
            transition: "transform 0.25s",
            display: "inline-block",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          ▼
        </span>
      </button>

      {/* Body */}
      {open && (
        <div style={{ borderTop: "1px solid var(--border-glass)" }}>
          {/* Filter pills */}
          <div style={{ display: "flex", gap: "0.4rem", padding: "0.6rem 1rem", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            {(["all", "speech", "visual"] as const).map((f) => (
              <button
                key={f}
                id={`timeline-filter-${f}`}
                onClick={() => setFilter(f)}
                style={{
                  padding: "0.2rem 0.7rem",
                  borderRadius: 99,
                  border: `1px solid ${filter === f ? "rgba(124,58,237,0.5)" : "rgba(255,255,255,0.08)"}`,
                  background: filter === f ? "rgba(124,58,237,0.18)" : "transparent",
                  color: filter === f ? "#a78bfa" : "var(--text-muted)",
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                {f === "all" ? "All" : f === "speech" ? "🎙 Speech" : "👁 Visual"}
              </button>
            ))}
          </div>

          {/* Scrollable event list */}
          <div
            style={{
              maxHeight: 300,
              overflowY: "auto",
              padding: "0.5rem 0.75rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.25rem",
            }}
          >
            {filtered.map((ev, i) => {
              const isVisual = ev.type === "visual";
              const label = isVisual
                ? ev.ocr_text?.slice(0, 80) || "Board snapshot"
                : ev.text?.slice(0, 80) || "";
              return (
                <button
                  key={i}
                  id={`timeline-ev-${i}`}
                  onClick={() => onSeek(ev.time_sec)}
                  title={ev.text || ev.ocr_text || ""}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.6rem",
                    padding: "0.45rem 0.7rem",
                    borderRadius: 8,
                    border: "1px solid transparent",
                    background: "transparent",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.15s",
                    width: "100%",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = isVisual
                      ? "rgba(6,182,212,0.08)"
                      : "rgba(124,58,237,0.08)";
                    (e.currentTarget as HTMLButtonElement).style.borderColor = isVisual
                      ? "rgba(6,182,212,0.2)"
                      : "rgba(124,58,237,0.2)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                    (e.currentTarget as HTMLButtonElement).style.borderColor = "transparent";
                  }}
                >
                  {/* Type dot */}
                  <div
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      flexShrink: 0,
                      background: isVisual ? "#06b6d4" : "#7c3aed",
                    }}
                  />

                  {/* Timestamp badge */}
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontSize: "0.72rem",
                      color: isVisual ? "#67e8f9" : "#a78bfa",
                      flexShrink: 0,
                      background: isVisual ? "rgba(6,182,212,0.1)" : "rgba(124,58,237,0.1)",
                      padding: "0.1rem 0.4rem",
                      borderRadius: 4,
                    }}
                  >
                    {ev.time_str}
                  </span>

                  {/* Icon */}
                  <span style={{ flexShrink: 0, fontSize: "0.75rem" }}>
                    {isVisual ? "👁" : "🎙"}
                  </span>

                  {/* Text snippet */}
                  <span
                    style={{
                      fontSize: "0.78rem",
                      color: "var(--text-secondary)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      flex: 1,
                    }}
                  >
                    {label}
                  </span>

                  {/* Play arrow */}
                  <span style={{ color: "var(--text-muted)", fontSize: "0.7rem", flexShrink: 0 }}>▶</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function NotesPanel({ markdown, timeline, onSeek }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

      {/* Timeline accordion */}
      {timeline.length > 0 && (
        <TimelineAccordion timeline={timeline} onSeek={onSeek} />
      )}

      {/* Markdown notes */}
      <div className="prose-nexus">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            // Intercept #t=NNN timestamp links → seekTo
            a: ({ href, children }) => {
              const match = href?.match(/^#t=(\d+)$/);
              if (match) {
                return (
                  <button
                    className="ts-btn"
                    onClick={() => onSeek(Number(match[1]))}
                    style={{ display: "inline-flex" }}
                  >
                    ▶ {children}
                  </button>
                );
              }
              return <a href={href} target="_blank" rel="noreferrer">{children}</a>;
            },
          }}
        >
          {markdown}
        </ReactMarkdown>
      </div>
    </div>
  );
}
