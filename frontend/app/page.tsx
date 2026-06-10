"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function HomePage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE}/api/process-video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      router.push(`/dashboard/${data.video_id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Is the backend running?");
      setLoading(false);
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        background:
          "radial-gradient(ellipse at 20% 50%, rgba(124,58,237,0.15) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(6,182,212,0.12) 0%, transparent 55%), var(--bg-primary)",
      }}
    >
      {/* ── Hero ───────────────────────────────────────────── */}
      <div
        className="animate-fade-in-up"
        style={{ textAlign: "center", maxWidth: 680, marginBottom: "3rem" }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            background: "rgba(124,58,237,0.15)",
            border: "1px solid rgba(124,58,237,0.3)",
            borderRadius: 99,
            padding: "0.35rem 1rem",
            fontSize: "0.8rem",
            color: "#a78bfa",
            fontWeight: 600,
            marginBottom: "1.5rem",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}
        >
          <span>✦</span> Powered by Gemini 1.5 Flash + Whisper
        </div>

        <h1
          style={{
            marginBottom: "1.25rem",
          }}
        >
          <img src="/logo.png" alt="NexusNotes" style={{ height: 260, width: "auto", margin: "-40px auto -30px" }} />
        </h1>

        <p
          style={{
            fontSize: "1.2rem",
            color: "#94a3b8",
            lineHeight: 1.7,
            maxWidth: 520,
            margin: "0 auto",
          }}
        >
          Paste any YouTube lecture URL. We extract audio, capture key board
          moments, fuse them together, and return beautiful Cornell notes +
          a quiz — in minutes.
        </p>
      </div>

      {/* ── URL Input Card ─────────────────────────────────── */}
      <div
        className="glass-card animate-fade-in-up"
        style={{
          width: "100%",
          maxWidth: 600,
          padding: "2rem",
          animationDelay: "0.15s",
        }}
      >
        <form onSubmit={handleSubmit}>
          <label
            htmlFor="youtube-url"
            style={{
              display: "block",
              fontSize: "0.85rem",
              fontWeight: 600,
              color: "#94a3b8",
              marginBottom: "0.6rem",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            YouTube URL
          </label>

          <div style={{ display: "flex", gap: "0.75rem" }}>
            <input
              id="youtube-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              required
              style={{
                flex: 1,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 10,
                padding: "0.75rem 1rem",
                color: "var(--text-primary)",
                fontSize: "0.95rem",
                outline: "none",
                transition: "border-color 0.2s",
              }}
              onFocus={(e) =>
                (e.target.style.borderColor = "rgba(124,58,237,0.6)")
              }
              onBlur={(e) =>
                (e.target.style.borderColor = "rgba(255,255,255,0.1)")
              }
            />

            <button
              id="submit-btn"
              type="submit"
              className="btn-primary"
              disabled={loading}
              style={{ whiteSpace: "nowrap" }}
            >
              {loading ? (
                <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <SpinnerIcon /> Processing…
                </span>
              ) : (
                "Generate Notes ✦"
              )}
            </button>
          </div>

          {error && (
            <p
              style={{
                marginTop: "0.75rem",
                color: "#f87171",
                fontSize: "0.875rem",
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.2)",
                borderRadius: 8,
                padding: "0.5rem 0.75rem",
              }}
            >
              ⚠ {error}
            </p>
          )}
        </form>
      </div>

      {/* ── Feature Pills ───────────────────────────────────── */}
      <div
        className="animate-fade-in-up"
        style={{
          display: "flex",
          gap: "0.75rem",
          flexWrap: "wrap",
          justifyContent: "center",
          marginTop: "2.5rem",
          animationDelay: "0.3s",
        }}
      >
        {[
          { icon: "🎙", label: "Whisper Transcription" },
          { icon: "👁", label: "Board Frame Extraction" },
          { icon: "✦", label: "Cornell Notes" },
          { icon: "🗺", label: "Mind Map" },
          { icon: "📊", label: "Mermaid Diagrams" },
          { icon: "🧠", label: "Auto Quiz" },
        ].map(({ icon, label }) => (
          <div
            key={label}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 99,
              padding: "0.4rem 1rem",
              fontSize: "0.82rem",
              color: "#94a3b8",
            }}
          >
            <span>{icon}</span> {label}
          </div>
        ))}
      </div>
    </main>
  );
}

function SpinnerIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      style={{ animation: "spin 0.8s linear infinite" }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
