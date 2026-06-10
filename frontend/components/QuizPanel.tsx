"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { QuizQuestion } from "@/app/dashboard/[videoId]/page";

interface Props { questions: QuizQuestion[] }

const OPTION_LETTERS = ["A","B","C","D"];
const COLORS = {
  idle:    { bg:"rgba(255,255,255,0.04)", border:"rgba(255,255,255,0.08)", text:"#cbd5e1" },
  hover:   { bg:"rgba(124,58,237,0.12)",  border:"rgba(124,58,237,0.4)",   text:"#e2e8f0" },
  correct: { bg:"rgba(34,197,94,0.2)",    border:"#22c55e",                text:"#4ade80"  },
  wrong:   { bg:"rgba(239,68,68,0.15)",   border:"#ef4444",                text:"#f87171"  },
  reveal:  { bg:"rgba(34,197,94,0.12)",   border:"rgba(34,197,94,0.4)",    text:"#4ade80"  },
};

const GRADE = (pct: number) =>
  pct >= 90 ? {label:"S",color:"#facc15",msg:"Legendary! Perfect understanding."} :
  pct >= 75 ? {label:"A",color:"#4ade80",msg:"Excellent! You nailed it."} :
  pct >= 60 ? {label:"B",color:"#67e8f9",msg:"Good work! Solid grasp."} :
  pct >= 40 ? {label:"C",color:"#fb923c",msg:"Decent start. Review the notes."} :
              {label:"D",color:"#f87171",msg:"Keep studying — you've got this!"};

type Phase = "intro" | "playing" | "answered" | "finished";

export default function QuizPanel({ questions }: Props) {
  const [phase,     setPhase]     = useState<Phase>("intro");
  const [qIdx,      setQIdx]      = useState(0);
  const [selected,  setSelected]  = useState<string|null>(null);
  const [score,     setScore]     = useState(0);
  const [combo,     setCombo]     = useState(0);
  const [correct,   setCorrect]   = useState(0);
  const [timeLeft,  setTimeLeft]  = useState(12);
  const [particles, setParticles] = useState<{id:number;x:number;y:number;c:string}[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval>|null>(null);
  const ansRef   = useRef<HTMLDivElement>(null);

  const q = questions[qIdx];
  const pct = questions.length ? Math.round(correct/questions.length*100) : 0;

  const stopTimer = () => { if(timerRef.current) clearInterval(timerRef.current); };

  const advance = useCallback(() => {
    stopTimer();
    if (qIdx + 1 < questions.length) {
      setTimeout(() => {
        setQIdx(i=>i+1); setSelected(null);
        setTimeLeft(12); setPhase("playing");
      }, 1800);
    } else {
      setTimeout(() => setPhase("finished"), 1800);
    }
  }, [qIdx, questions.length]);

  const answer = useCallback((opt: string) => {
    if (phase !== "playing") return;
    stopTimer();
    setSelected(opt);
    setPhase("answered");

    const isRight = opt === q.answer;
    if (isRight) {
      const bonus = Math.ceil(timeLeft / 12 * 50);
      const comboBonus = combo * 25;
      setScore(s => s + 100 + bonus + comboBonus);
      setCorrect(c => c+1);
      setCombo(c => c+1);
      // Particle burst
      const px = Array.from({length:14},(_,i)=>({
        id: Date.now()+i, x:40+Math.random()*60, y:20+Math.random()*60,
        c:["#a78bfa","#67e8f9","#4ade80","#facc15","#f472b6"][i%5]
      }));
      setParticles(px);
      setTimeout(()=>setParticles([]),1500);
    } else {
      setCombo(0);
    }
    advance();
  }, [phase, q, timeLeft, combo, advance]);

  // Countdown timer
  useEffect(() => {
    if (phase !== "playing") return;
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { answer(q.options[Math.floor(Math.random()*q.options.length)]+"__timeout"); return 0; }
        return t-1;
      });
    }, 1000);
    return stopTimer;
  }, [phase, qIdx]);

  const restart = () => {
    setPhase("intro"); setQIdx(0); setSelected(null);
    setScore(0); setCombo(0); setCorrect(0); setTimeLeft(12);
  };

  // ── Intro screen ─────────────────────────────────────────────────────────
  if (phase === "intro") return (
    <div style={{ textAlign:"center", padding:"2rem 1rem" }}>
      <div style={{ fontSize:"3rem", marginBottom:"1rem" }}>🧠</div>
      <h2 style={{ fontWeight:800, fontSize:"1.5rem", background:"linear-gradient(135deg,#a78bfa,#67e8f9)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", marginBottom:".5rem" }}>
        Knowledge Arena
      </h2>
      <p style={{ color:"#64748b", marginBottom:"2rem", fontSize:".9rem" }}>
        {questions.length} questions · 12s per question · Combo bonuses for streaks
      </p>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:".75rem", maxWidth:360, margin:"0 auto 2rem" }}>
        {[["⚡","Speed bonus","Answer fast for +50pts"],["🔥","Combos","Streak = extra points"],["🏆","Grade","S / A / B / C / D"]].map(([icon,label,desc])=>(
          <div key={label} style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:12, padding:".75rem .5rem" }}>
            <p style={{ fontSize:"1.3rem" }}>{icon}</p>
            <p style={{ fontWeight:700, fontSize:".72rem", color:"#e2e8f0" }}>{label}</p>
            <p style={{ fontSize:".63rem", color:"#475569", marginTop:2 }}>{desc}</p>
          </div>
        ))}
      </div>
      <button id="quiz-start-btn" onClick={()=>setPhase("playing")}
        style={{ padding:".9rem 2.5rem", borderRadius:99, border:"none", cursor:"pointer",
          background:"linear-gradient(135deg,#7c3aed,#06b6d4)", color:"#fff", fontWeight:800,
          fontSize:"1rem", boxShadow:"0 0 30px rgba(124,58,237,0.4)", transition:"transform .2s" }}
        onMouseEnter={e=>(e.currentTarget.style.transform="scale(1.05)")}
        onMouseLeave={e=>(e.currentTarget.style.transform="scale(1)")}>
        Start Quiz ▶
      </button>
    </div>
  );

  // ── Finished screen ───────────────────────────────────────────────────────
  if (phase === "finished") {
    const grade = GRADE(pct);
    return (
      <div style={{ textAlign:"center", padding:"1.5rem 1rem" }}>
        <div style={{ fontSize:"4rem", marginBottom:".5rem", animation:"float 3s ease-in-out infinite" }}>🏆</div>
        <p style={{ fontSize:".7rem", fontWeight:700, letterSpacing:".1em", textTransform:"uppercase", color:"#a78bfa", marginBottom:".3rem" }}>Quiz Complete</p>
        <h2 style={{ fontWeight:900, fontSize:"2.5rem", color:grade.color, marginBottom:".25rem" }}>Grade {grade.label}</h2>
        <p style={{ color:"#94a3b8", marginBottom:"1.5rem" }}>{grade.msg}</p>

        {/* Stats */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:".75rem", maxWidth:400, margin:"0 auto 1.5rem" }}>
          {[
            ["🎯","Score",score.toLocaleString(),"#a78bfa"],
            ["✅","Correct",`${correct}/${questions.length}`,"#4ade80"],
            ["📊","Accuracy",`${pct}%`,"#67e8f9"],
          ].map(([icon,label,val,c])=>(
            <div key={label} style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:14, padding:"1rem .5rem" }}>
              <p style={{ fontSize:"1.4rem" }}>{icon}</p>
              <p style={{ fontWeight:800, fontSize:"1.3rem", color:c as string }}>{val}</p>
              <p style={{ fontSize:".68rem", color:"#475569" }}>{label}</p>
            </div>
          ))}
        </div>

        {/* Per-question summary */}
        <div style={{ maxWidth:480, margin:"0 auto 1.5rem", textAlign:"left" }}>
          {questions.map((q,i)=>(
            <div key={i} style={{ display:"flex", alignItems:"center", gap:".6rem", padding:".4rem .6rem",
              borderRadius:8, marginBottom:"0.3rem", background:"rgba(255,255,255,0.02)" }}>
              <span style={{ fontSize:".8rem" }}>{i+1}.</span>
              <span style={{ flex:1, fontSize:".72rem", color:"#94a3b8", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{q.question}</span>
              <span style={{ fontSize:".75rem" }}>{i < correct ? "✅" : "❌"}</span>
            </div>
          ))}
        </div>

        <button id="quiz-restart-btn" onClick={restart}
          style={{ padding:".75rem 2rem", borderRadius:99, border:"1px solid rgba(124,58,237,0.4)",
            background:"rgba(124,58,237,0.12)", color:"#a78bfa", fontWeight:700, cursor:"pointer", fontSize:".9rem" }}>
          ↺ Try Again
        </button>
      </div>
    );
  }

  // ── Question screen ───────────────────────────────────────────────────────
  const timePct = timeLeft / 12 * 100;
  const timeColor = timeLeft > 7 ? "#4ade80" : timeLeft > 4 ? "#facc15" : "#f87171";

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"1rem", position:"relative" }}>
      {/* Particles */}
      {particles.map(p=>(
        <div key={p.id} style={{ position:"absolute", left:`${p.x}%`, top:`${p.y}%`,
          width:8, height:8, borderRadius:"50%", background:p.c, pointerEvents:"none",
          animation:"fade-in-up .4s ease forwards", zIndex:10 }}/>
      ))}

      {/* HUD row */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr auto 1fr", alignItems:"center", gap:".5rem" }}>
        {/* Score */}
        <div>
          <p style={{ fontSize:".6rem", color:"#475569", textTransform:"uppercase", letterSpacing:".08em" }}>Score</p>
          <p style={{ fontWeight:800, fontSize:"1.2rem", color:"#a78bfa" }}>{score.toLocaleString()}</p>
        </div>
        {/* Progress */}
        <div style={{ textAlign:"center" }}>
          <p style={{ fontSize:".7rem", color:"#64748b" }}>Q {qIdx+1} / {questions.length}</p>
          <div style={{ display:"flex", gap:3, marginTop:4 }}>
            {questions.map((_,i)=>(
              <div key={i} style={{ width:16, height:4, borderRadius:99,
                background: i<qIdx ? "#7c3aed" : i===qIdx ? "#06b6d4" : "rgba(255,255,255,0.08)" }}/>
            ))}
          </div>
        </div>
        {/* Combo */}
        <div style={{ textAlign:"right" }}>
          <p style={{ fontSize:".6rem", color:"#475569", textTransform:"uppercase", letterSpacing:".08em" }}>Combo</p>
          <p style={{ fontWeight:800, fontSize:"1.2rem", color: combo>1?"#facc15":"#475569" }}>
            {combo>1 ? `🔥 ×${combo}` : "–"}
          </p>
        </div>
      </div>

      {/* Timer bar */}
      <div style={{ height:5, background:"rgba(255,255,255,0.06)", borderRadius:99, overflow:"hidden" }}>
        <div style={{ height:"100%", borderRadius:99, background:timeColor,
          width:`${timePct}%`, transition:"width 1s linear, background .5s",
          boxShadow:`0 0 8px ${timeColor}88` }}/>
      </div>
      <div style={{ display:"flex", justifyContent:"flex-end" }}>
        <span style={{ fontFamily:"monospace", fontSize:".75rem", color:timeColor, fontWeight:700 }}>⏱ {timeLeft}s</span>
      </div>

      {/* Question */}
      <div style={{ background:"rgba(124,58,237,0.08)", border:"1px solid rgba(124,58,237,0.2)",
        borderRadius:14, padding:"1.25rem 1rem" }}>
        <p style={{ fontSize:".65rem", fontWeight:700, color:"#a78bfa", letterSpacing:".1em", textTransform:"uppercase", marginBottom:".5rem" }}>
          Question {qIdx+1}
        </p>
        <p style={{ fontWeight:600, fontSize:".95rem", color:"#e2e8f0", lineHeight:1.5 }}>{q.question}</p>
      </div>

      {/* Options */}
      <div ref={ansRef} style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:".6rem" }}>
        {q.options.map((opt,i)=>{
          const letter = OPTION_LETTERS[i];
          const isSelected = selected === opt;
          const isCorrect  = opt === q.answer;
          const answered   = phase === "answered";

          let state: keyof typeof COLORS = "idle";
          if (answered) {
            if (isCorrect)  state = "reveal";
            if (isSelected && !isCorrect) state = "wrong";
            if (isSelected && isCorrect)  state = "correct";
          }
          const c = COLORS[state];

          return (
            <button
              key={i}
              id={`quiz-opt-${letter}`}
              onClick={()=>answer(opt)}
              disabled={answered}
              style={{
                display:"flex", alignItems:"flex-start", gap:".6rem",
                padding:".85rem .9rem", borderRadius:12, border:`2px solid ${c.border}`,
                background:c.bg, cursor:answered?"not-allowed":"pointer",
                textAlign:"left", transition:"all .2s", color:c.text,
                animation: answered && isSelected && !isCorrect ? "shake .4s ease" : "none",
              }}
              onMouseEnter={e=>{ if(!answered)(e.currentTarget as HTMLButtonElement).style.background=COLORS.hover.bg; }}
              onMouseLeave={e=>{ if(!answered)(e.currentTarget as HTMLButtonElement).style.background=COLORS.idle.bg; }}
            >
              <span style={{ flexShrink:0, width:24, height:24, borderRadius:6,
                background:"rgba(255,255,255,0.06)", display:"flex", alignItems:"center",
                justifyContent:"center", fontWeight:800, fontSize:".75rem", color:c.text }}>
                {answered && isCorrect ? "✓" : answered && isSelected ? "✗" : letter}
              </span>
              <span style={{ fontSize:".82rem", lineHeight:1.4, fontWeight: isSelected?600:400 }}>{opt}</span>
            </button>
          );
        })}
      </div>

      {/* Explanation (after answering) */}
      {phase === "answered" && q.explanation && (
        <div style={{ background:"rgba(6,182,212,0.08)", border:"1px solid rgba(6,182,212,0.2)",
          borderRadius:12, padding:".9rem 1rem", animation:"fade-in-up .3s ease" }}>
          <p style={{ fontSize:".68rem", fontWeight:700, color:"#67e8f9", marginBottom:".3rem", letterSpacing:".08em", textTransform:"uppercase" }}>
            💡 Explanation
          </p>
          <p style={{ fontSize:".82rem", color:"#94a3b8", lineHeight:1.5 }}>{q.explanation}</p>
        </div>
      )}
    </div>
  );
}
