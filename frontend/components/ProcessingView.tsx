"use client";

import { useEffect, useRef, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const STEP_ICONS = ["⚙", "⬇", "👁", "🎙", "✦", "🧠", "💾", "✅"];
const STEP_LABELS = [
  "Initializing",
  "Downloading Streams",
  "Extracting Keyframes",
  "Transcribing Audio",
  "Fusing with Gemini",
  "Generating Quiz",
  "Saving Results",
  "Complete",
];
const STEP_DESCRIPTIONS = [
  "Starting the pipeline…",
  "Fetching audio & video from YouTube via yt-dlp",
  "SSIM pixel diff → stability window → OCR deduplication",
  "OpenAI Whisper speech-to-text with word timestamps",
  "Interleaving transcript + frames → Gemini 1.5 Flash",
  "Gemini generates 8 MCQ questions from your notes",
  "Persisting notes & quiz to database",
  "Your notes are ready!",
];

const FUN_FACTS = [
  "SSIM (Structural Similarity Index) is the same metric Netflix uses to detect scene changes.",
  "Whisper was trained on 680,000 hours of multilingual audio — more than 77 years of speech.",
  "Gemini 2.0 Flash can process 1M tokens — equivalent to ~750,000 words in a single call.",
  "Cornell Notes were invented in the 1950s by Walter Pauk at Cornell University.",
  "The average lecture contains 5,000–7,000 words — Whisper transcribes them in seconds.",
  "SSIM scores above 0.92 mean frames are 'nearly identical' and can be safely skipped.",
  "OCR (Optical Character Recognition) on a board frame takes ~200ms per frame with Tesseract.",
];

interface ProgressData {
  status: string;
  current_step: number;
  step_name: string;
  step_message: string;
  step_progress: number;
  stats: Record<string, unknown>;
  logs: string[];
}

interface Props {
  videoId: string;
  onComplete: () => void;
  onRetry: () => void;
}

export default function ProcessingView({ videoId, onComplete, onRetry }: Props) {
  const [progress, setProgress] = useState<ProgressData>({
    status: "processing",
    current_step: 0,
    step_name: "Initializing",
    step_message: "Starting pipeline…",
    step_progress: 0,
    stats: {},
    logs: [],
  });
  const [elapsed, setElapsed] = useState(0);
  const [factIdx, setFactIdx] = useState(0);
  const [capturedFrames, setCapturedFrames] = useState<string[]>([]);
  const logRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<number>(Date.now());
  const esRef = useRef<EventSource | null>(null);

  // Timer
  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  // Rotate fun facts
  useEffect(() => {
    const t = setInterval(() => setFactIdx((i) => (i + 1) % FUN_FACTS.length), 6000);
    return () => clearInterval(t);
  }, []);

  // SSE connection
  useEffect(() => {
    const es = new EventSource(`${API_BASE}/api/progress/${videoId}`);
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const data: ProgressData = JSON.parse(e.data);
        setProgress(data);

        // Collect new keyframe paths from stats
        const latestFrame = data.stats?.latest_frame as string | undefined;
        if (latestFrame) {
          setCapturedFrames((prev) => {
            if (!prev.includes(latestFrame)) return [...prev.slice(-11), latestFrame];
            return prev;
          });
        }

        if (data.status === "completed") {
          es.close();
          setTimeout(onComplete, 1500);
        }
      } catch {}
    };

    es.onerror = () => es.close();
    return () => es.close();
  }, [videoId, onComplete]);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = 0;
  }, [progress.logs]);

  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const isFailed = progress.status === "failed";
  const isDone = progress.status === "completed";
  const step = progress.current_step;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-primary)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* ── Animated background particles ─── */}
      <Particles />

      <div style={{ position: "relative", zIndex: 1, padding: "2rem", maxWidth: 1200, margin: "0 auto" }}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "2rem" }}>
          <a href="/" style={{ display: "flex", alignItems: "center" }}>
            <img src="/logo.png" alt="NexusNotes" style={{ height: 100, width: "auto", margin: "-25px 0 -25px -15px" }} />
          </a>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <span style={{ fontFamily: "monospace", color: "#64748b", fontSize: "0.9rem" }}>⏱ {fmt(elapsed)}</span>
            <span className={`status-badge status-${isFailed ? "failed" : isDone ? "completed" : "processing"}`}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "currentColor", display: "inline-block",
                animation: !isFailed && !isDone ? "pulse-ring 1.5s infinite" : "none" }} />
              {isFailed ? "Failed" : isDone ? "Complete" : "Processing"}
            </span>
          </div>
        </div>

        {/* ── Main grid ──────────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "1.5rem", alignItems: "start" }}>

          {/* Left: step list */}
          <div className="glass-card" style={{ padding: "1.5rem" }}>
            <p style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: "1.25rem" }}>
              Pipeline Steps
            </p>
            {STEP_LABELS.slice(1).map((label, i) => {
              const stepNum = i + 1;
              const done = step > stepNum || isDone;
              const active = step === stepNum && !isFailed && !isDone;
              const failed = isFailed && step === stepNum;
              return (
                <div key={stepNum} style={{
                  display: "flex", alignItems: "center", gap: "0.75rem",
                  padding: "0.6rem 0.75rem", borderRadius: 10, marginBottom: "0.35rem",
                  background: active ? "rgba(124,58,237,0.12)" : done ? "rgba(34,197,94,0.06)" : "transparent",
                  border: active ? "1px solid rgba(124,58,237,0.3)" : "1px solid transparent",
                  transition: "all 0.4s ease",
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: done ? "0.85rem" : "0.75rem",
                    background: done ? "rgba(34,197,94,0.2)" : active ? "rgba(124,58,237,0.2)" : "rgba(255,255,255,0.05)",
                    border: `2px solid ${done ? "#4ade80" : active ? "#7c3aed" : "rgba(255,255,255,0.1)"}`,
                    animation: active ? "spin 2s linear infinite" : "none",
                  }}>
                    {done ? "✓" : failed ? "✗" : STEP_ICONS[stepNum]}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: "0.82rem", fontWeight: done || active ? 600 : 400,
                      color: done ? "#4ade80" : active ? "#a78bfa" : "#475569",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {label}
                    </p>
                  </div>
                </div>
              );
            })}

            {/* Retry button when failed */}
            {isFailed && (
              <button
                id="retry-btn"
                onClick={onRetry}
                className="btn-primary"
                style={{ width: "100%", marginTop: "1rem", fontSize: "0.85rem" }}
              >
                ↺ Resume from Checkpoint
              </button>
            )}
          </div>

          {/* Right: main display */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

            {/* Current step hero card */}
            <div className="glass-card" style={{ padding: "2rem", position: "relative", overflow: "hidden" }}>
              {/* Glow blob */}
              <div style={{
                position: "absolute", top: -60, right: -60, width: 200, height: 200,
                background: isDone ? "rgba(34,197,94,0.15)" : isFailed ? "rgba(239,68,68,0.15)" : "rgba(124,58,237,0.2)",
                borderRadius: "50%", filter: "blur(60px)", transition: "background 0.5s",
              }} />

              <div style={{ position: "relative" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1rem" }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: 16,
                    background: "rgba(124,58,237,0.2)", border: "2px solid rgba(124,58,237,0.4)",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.6rem",
                    animation: !isDone && !isFailed ? "float 3s ease-in-out infinite" : "none",
                  }}>
                    {isFailed ? "❌" : isDone ? "🎉" : STEP_ICONS[step] || "⚙"}
                  </div>
                  <div>
                    <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".07em" }}>
                      {isDone ? "All Done" : isFailed ? "Pipeline Error" : `Step ${step} of 6`}
                    </p>
                    <h2 style={{ fontWeight: 700, fontSize: "1.4rem" }}>
                      {isDone ? "Notes Ready!" : isFailed ? "Processing Failed" : STEP_LABELS[step] || "Working…"}
                    </h2>
                  </div>
                </div>

                <p style={{ color: "#94a3b8", fontSize: "0.9rem", marginBottom: "1.25rem", minHeight: 22 }}>
                  {progress.step_message || STEP_DESCRIPTIONS[step] || ""}
                </p>

                {/* Progress bar */}
                {!isDone && !isFailed && (
                  <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 99, height: 8, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: 99,
                      background: "linear-gradient(90deg,#7c3aed,#06b6d4)",
                      width: `${Math.max(3, progress.step_progress)}%`,
                      transition: "width 0.8s ease",
                      boxShadow: "0 0 12px rgba(124,58,237,0.5)",
                    }} />
                  </div>
                )}
              </div>
            </div>

            {/* Stats row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "0.75rem" }}>
              {[
                { label: "Frames Analyzed", value: (progress.stats.frames_analyzed as number) || 0, suffix: "" },
                { label: "Keyframes Saved", value: (progress.stats.keyframes_saved as number) || 0, suffix: "" },
                { label: "Audio Segments", value: (progress.stats.transcript_segments as number) || 0, suffix: "" },
                { label: "Elapsed", value: fmt(elapsed), suffix: "", raw: true },
              ].map((s) => (
                <div key={s.label} className="glass-card" style={{ padding: "1rem", textAlign: "center" }}>
                  <p style={{ fontSize: s.raw ? "1.4rem" : "1.6rem", fontWeight: 800,
                    background: "linear-gradient(135deg,#7c3aed,#06b6d4)",
                    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                    {s.raw ? s.value : (s.value as number).toLocaleString()}{s.suffix}
                  </p>
                  <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.2rem", textTransform: "uppercase", letterSpacing: ".06em" }}>
                    {s.label}
                  </p>
                </div>
              ))}
            </div>

            {/* Keyframe filmstrip */}
            {capturedFrames.length > 0 && (
              <div className="glass-card" style={{ padding: "1rem" }}>
                <p style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--text-muted)", letterSpacing: ".08em", textTransform: "uppercase", marginBottom: "0.75rem" }}>
                  📸 Live Board Captures
                </p>
                <div style={{ display: "flex", gap: "0.5rem", overflowX: "auto", paddingBottom: "0.25rem" }}>
                  {capturedFrames.map((path, i) => (
                    <img
                      key={i}
                      src={`${API_BASE}/api/keyframe?path=${encodeURIComponent(path)}`}
                      alt={`Frame ${i}`}
                      style={{
                        height: 80, width: "auto", borderRadius: 8, flexShrink: 0,
                        border: i === capturedFrames.length - 1
                          ? "2px solid var(--accent-purple)"
                          : "2px solid rgba(255,255,255,0.08)",
                        animation: i === capturedFrames.length - 1 ? "fade-in-up 0.4s ease" : "none",
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Live log terminal */}
            <div className="glass-card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{
                display: "flex", alignItems: "center", padding: "0.6rem 1rem",
                borderBottom: "1px solid var(--border-glass)", background: "rgba(0,0,0,0.3)",
                gap: "0.4rem",
              }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ef4444" }} />
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#fbbf24" }} />
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#4ade80" }} />
                <span style={{ marginLeft: "0.5rem", fontSize: "0.75rem", color: "#475569", fontFamily: "monospace" }}>
                  nexusnotes — pipeline log
                </span>
              </div>
              <div
                ref={logRef}
                style={{
                  fontFamily: "monospace", fontSize: "0.78rem", color: "#94a3b8",
                  padding: "0.75rem 1rem", maxHeight: 160, overflowY: "auto",
                  background: "rgba(0,0,0,0.2)",
                }}
              >
                {(progress.logs.length ? progress.logs : ["Waiting for pipeline to start…"]).map((line, i) => (
                  <div key={i} style={{
                    display: "flex", gap: "0.5rem", alignItems: "flex-start",
                    color: line.includes("✓") ? "#4ade80" : line.includes("❌") ? "#f87171" : "#94a3b8",
                    animation: i === 0 ? "fade-in-up 0.3s ease" : "none",
                    marginBottom: "0.2rem",
                  }}>
                    <span style={{ color: "#7c3aed", flexShrink: 0 }}>▶</span>
                    <span>{line}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Fun fact ticker */}
            <div style={{
              display: "flex", alignItems: "center", gap: "0.75rem",
              background: "rgba(6,182,212,0.06)", border: "1px solid rgba(6,182,212,0.15)",
              borderRadius: 12, padding: "0.75rem 1rem",
            }}>
              <span style={{ fontSize: "1.1rem", flexShrink: 0 }}>💡</span>
              <p style={{ fontSize: "0.82rem", color: "#67e8f9", lineHeight: 1.5, animation: "fade-in-up 0.5s ease" }} key={factIdx}>
                <strong>Did you know?</strong> {FUN_FACTS[factIdx]}
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

// Pure-CSS floating particles — generated client-side only to avoid SSR hydration mismatch
function Particles() {
  const [particles, setParticles] = useState<
    { id: number; x: number; y: number; size: number; duration: number; delay: number; opacity: number; color: string }[]
  >([]);

  useEffect(() => {
    setParticles(
      Array.from({ length: 20 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 3 + 1,
        duration: Math.random() * 15 + 10,
        delay: Math.random() * 10,
        opacity: Math.random() * 0.3 + 0.05,
        color: i % 3 === 0 ? "#7c3aed" : i % 3 === 1 ? "#06b6d4" : "#4ade80",
      }))
    );
  }, []); // runs once after mount — never on server

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
      {particles.map((p) => (
        <div
          key={p.id}
          style={{
            position: "absolute",
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            borderRadius: "50%",
            background: p.color,
            opacity: p.opacity,
            animation: `float ${p.duration}s ${p.delay}s ease-in-out infinite alternate`,
          }}
        />
      ))}
      {/* Large ambient blobs */}
      <div style={{ position: "absolute", top: "10%", left: "5%", width: 400, height: 400,
        background: "rgba(124,58,237,0.06)", borderRadius: "50%", filter: "blur(80px)", animation: "float 20s ease-in-out infinite alternate" }} />
      <div style={{ position: "absolute", bottom: "10%", right: "5%", width: 350, height: 350,
        background: "rgba(6,182,212,0.05)", borderRadius: "50%", filter: "blur(80px)", animation: "float 16s 5s ease-in-out infinite alternate" }} />
    </div>
  );
}
