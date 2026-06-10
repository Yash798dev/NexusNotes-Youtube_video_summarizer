"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import VideoPlayer, { VideoPlayerHandle } from "@/components/VideoPlayer";
import NotesPanel from "@/components/NotesPanel";
import MindMapView from "@/components/MindMapView";
import DiagramView from "@/components/DiagramView";
import QuizPanel from "@/components/QuizPanel";
import ProcessingView from "@/components/ProcessingView";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type Tab = "notes" | "mindmap" | "diagrams" | "quiz";

interface VideoInfo {
  video_id: string;
  title: string;
  status: string;
  youtube_url?: string;
}

interface Notes {
  markdown_content: string;
  fused_timeline_json: TimelineEvent[];
}

export interface TimelineEvent {
  type: "speech" | "visual";
  time_sec: number;
  time_str: string;
  text?: string;
  ocr_text?: string;
  image_path?: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  answer: string;
  explanation: string;
}

/** Extract YouTube video ID from any URL format. */
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /[?&]v=([^&#]+)/,           // watch?v=XXX
    /youtu\.be\/([^?&#]+)/,     // youtu.be/XXX
    /\/embed\/([^?&#]+)/,       // /embed/XXX
    /\/shorts\/([^?&#]+)/,      // /shorts/XXX
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

export default function DashboardPage() {
  const { videoId } = useParams<{ videoId: string }>();
  const playerRef = useRef<VideoPlayerHandle>(null);

  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [notes, setNotes] = useState<Notes | null>(null);
  const [quiz, setQuiz] = useState<QuizQuestion[] | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("notes");
  const [ytVideoId, setYtVideoId] = useState("");

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/status/${videoId}`);
      if (!res.ok) return;
      const data: VideoInfo = await res.json();
      setVideoInfo(data);
      if (data.youtube_url) {
        const ytId = extractYouTubeId(data.youtube_url);
        if (ytId) setYtVideoId(ytId);
      }
      if (data.status === "completed") {
        fetchNotes();
        fetchQuiz();
      }
    } catch {}
  }, [videoId]);

  const fetchNotes = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/notes/${videoId}`);
      if (res.ok) setNotes(await res.json());
    } catch {}
  };

  const fetchQuiz = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/quiz/${videoId}`);
      if (res.ok) {
        const d = await res.json();
        setQuiz(d.questions);
      }
    } catch {}
  };

  const handleRetry = async () => {
    await fetch(`${API_BASE}/api/retry/${videoId}`, { method: "POST" });
    setVideoInfo((v) => v ? { ...v, status: "processing" } : v);
  };

  useEffect(() => {
    fetchStatus();
    const iv = setInterval(fetchStatus, 8000);
    return () => clearInterval(iv);
  }, [fetchStatus]);

  const seekTo = (seconds: number) => playerRef.current?.seekTo(seconds);

  // ── While processing → show the animated view ──────────────────────────
  if (!videoInfo || videoInfo.status === "processing") {
    return (
      <ProcessingView
        videoId={videoId}
        onComplete={() => {
          setVideoInfo((v) => v ? { ...v, status: "completed" } : v);
          fetchNotes();
          fetchQuiz();
          fetchStatus();
        }}
        onRetry={handleRetry}
      />
    );
  }

  // ── Failed state ────────────────────────────────────────────────────────
  if (videoInfo.status === "failed") {
    return (
      <ProcessingView
        videoId={videoId}
        onComplete={() => {}}
        onRetry={handleRetry}
      />
    );
  }

  // ── Completed dashboard ─────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(ellipse at 0% 0%, rgba(124,58,237,0.1) 0%, transparent 50%), var(--bg-primary)", display: "flex", flexDirection: "column" }}>

      {/* Top bar */}
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1rem 2rem",
        borderBottom: "1px solid var(--border-glass)", background: "rgba(10,10,18,0.8)", backdropFilter: "blur(20px)",
        position: "sticky", top: 0, zIndex: 100 }}>
        <a href="/" style={{ display: "flex", alignItems: "center" }}>
          <img src="/logo.png" alt="NexusNotes" style={{ height: 100, width: "auto", margin: "-25px 0 -25px -15px" }} />
        </a>
        <span style={{ color: "#94a3b8", fontSize: "0.9rem", maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {videoInfo.title}
        </span>
        <span className="status-badge status-completed">
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "currentColor", display: "inline-block" }} />
          completed
        </span>
      </header>

      {/* Split pane */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", padding: "1.5rem 2rem", flex: 1, alignItems: "start" }}>

        {/* Left: video */}
        <div style={{ position: "sticky", top: 80 }}>
          <div className="glass-card" style={{ overflow: "hidden", aspectRatio: "16/9", background: "#000" }}>
            {ytVideoId ? <VideoPlayer ref={playerRef} videoId={ytVideoId} /> : null}
          </div>
        </div>

        {/* Right: tabs */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div className="tab-bar">
            {(["notes", "mindmap", "diagrams", "quiz"] as Tab[]).map((tab) => (
              <button key={tab} id={`tab-${tab}`} className={`tab-btn ${activeTab === tab ? "active" : ""}`} onClick={() => setActiveTab(tab)}>
                {tab === "notes" && "📝 Notes"}
                {tab === "mindmap" && "🗺 Mind Map"}
                {tab === "diagrams" && "📊 Diagrams"}
                {tab === "quiz" && "🧠 Quiz"}
              </button>
            ))}
          </div>

          <div className="glass-card" style={{ padding: "1.5rem", minHeight: "60vh", overflowY: "auto" }}>
            {activeTab === "notes" && notes && <NotesPanel markdown={notes.markdown_content} timeline={notes.fused_timeline_json} onSeek={seekTo} />}
            {activeTab === "mindmap" && notes && <MindMapView markdown={notes.markdown_content} />}
            {activeTab === "diagrams" && notes && <DiagramView markdown={notes.markdown_content} />}
            {activeTab === "quiz" && quiz && <QuizPanel questions={quiz} />}
          </div>
        </div>
      </div>
    </div>
  );
}
