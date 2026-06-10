"use client";

import { useState } from "react";

const COLORS = [
  { bg: "rgba(124,58,237,0.12)", border: "#7c3aed", text: "#a78bfa", badge: "rgba(124,58,237,0.2)" },
  { bg: "rgba(6,182,212,0.12)",  border: "#06b6d4", text: "#67e8f9", badge: "rgba(6,182,212,0.2)" },
  { bg: "rgba(16,185,129,0.12)", border: "#10b981", text: "#34d399", badge: "rgba(16,185,129,0.2)" },
  { bg: "rgba(249,115,22,0.12)", border: "#f97316", text: "#fb923c", badge: "rgba(249,115,22,0.2)" },
  { bg: "rgba(236,72,153,0.12)", border: "#ec4899", text: "#f472b6", badge: "rgba(236,72,153,0.2)" },
  { bg: "rgba(234,179,8,0.12)",  border: "#eab308", text: "#facc15", badge: "rgba(234,179,8,0.2)" },
];

const SECTION_ICONS = ["🧠","⚡","🔬","💡","🎯","🌊","🔮","🚀","✦","📐"];

interface Section { title: string; subsections: string[]; bullets: string[] }

function parse(md: string): { title: string; sections: Section[] } {
  let title = "Knowledge Map";
  const sections: Section[] = [];
  let cur: Section | null = null;
  for (const raw of md.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("# "))       { title = line.slice(2).replace(/\*\*/g,"").trim(); }
    else if (line.startsWith("## ")) { if (cur) sections.push(cur); cur = { title: line.slice(3).replace(/\*\*/g,"").trim(), subsections:[], bullets:[] }; }
    else if (line.startsWith("### ") && cur) { cur.subsections.push(line.slice(4).replace(/\*\*/g,"").trim()); }
    else if ((line.startsWith("- ")||line.startsWith("* ")) && cur) {
      const b = line.slice(2).replace(/\*\*/g,"").replace(/\[.*?\]\(.*?\)/g,"").trim();
      if (b.length > 2 && b.length < 100) cur.bullets.push(b);
    }
  }
  if (cur) sections.push(cur);
  return { title, sections };
}

export default function MindMapView({ markdown }: { markdown: string }) {
  const { title, sections } = parse(markdown);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);

  if (sections.length === 0) return (
    <div style={{ textAlign:"center", padding:"3rem", color:"var(--text-muted)" }}>
      <p style={{ fontSize:"2rem" }}>🗺</p>
      <p>No sections found in notes.</p>
    </div>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"1.5rem" }}>

      {/* ── Title node ── */}
      <div style={{
        textAlign:"center", padding:"1.5rem 2rem",
        background:"linear-gradient(135deg,rgba(124,58,237,0.15),rgba(6,182,212,0.15))",
        border:"1px solid rgba(124,58,237,0.3)", borderRadius:20,
        position:"relative", overflow:"hidden",
      }}>
        <div style={{ position:"absolute",inset:0, background:"radial-gradient(ellipse at 50% 0%,rgba(124,58,237,0.1),transparent 70%)" }}/>
        <p style={{ fontSize:"0.65rem", fontWeight:700, letterSpacing:".12em", textTransform:"uppercase", color:"#a78bfa", marginBottom:".4rem" }}>
          ✦ Knowledge Constellation
        </p>
        <h2 style={{ fontWeight:800, fontSize:"1.25rem", background:"linear-gradient(135deg,#a78bfa,#67e8f9)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", lineHeight:1.3 }}>
          {title}
        </h2>
        <p style={{ fontSize:"0.78rem", color:"var(--text-muted)", marginTop:".5rem" }}>
          {sections.length} topics · {sections.reduce((a,s)=>a+s.subsections.length+s.bullets.length,0)} concepts
        </p>
      </div>

      {/* ── Branch connector line ── */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:0 }}>
        <div style={{ height:2, flex:1, background:"linear-gradient(90deg,transparent,rgba(124,58,237,0.4))" }}/>
        <div style={{ width:10,height:10,borderRadius:"50%",background:"#7c3aed",flexShrink:0 }}/>
        {sections.map((_,i)=>(
          <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center" }}>
            <div style={{ height:2, width:"100%", background:`linear-gradient(90deg,${COLORS[i%COLORS.length].border}88,${COLORS[(i+1)%COLORS.length].border}88)` }}/>
          </div>
        ))}
      </div>

      {/* ── Section cards grid ── */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))", gap:"1rem" }}>
        {sections.map((sec, i) => {
          const c = COLORS[i % COLORS.length];
          const isOpen = expanded === i;
          const isHov = hovered === i;
          const items = [...sec.subsections, ...sec.bullets.slice(0, 4)];

          return (
            <div
              key={i}
              onMouseEnter={()=>setHovered(i)}
              onMouseLeave={()=>setHovered(null)}
              onClick={()=>setExpanded(isOpen ? null : i)}
              style={{
                background: isHov ? c.bg.replace("0.12","0.2") : c.bg,
                border:`1px solid ${isHov ? c.border : c.border+"55"}`,
                borderRadius:16, padding:"1rem", cursor:"pointer",
                transition:"all 0.25s ease",
                transform: isHov ? "translateY(-3px)" : "none",
                boxShadow: isHov ? `0 8px 30px ${c.border}30` : "none",
                position:"relative", overflow:"hidden",
              }}
            >
              {/* Glow blob */}
              <div style={{ position:"absolute",top:-20,right:-20,width:80,height:80,
                borderRadius:"50%",background:c.border+"22",filter:"blur(20px)",pointerEvents:"none" }}/>

              {/* Header */}
              <div style={{ display:"flex", alignItems:"flex-start", gap:".6rem", marginBottom:".75rem" }}>
                <span style={{
                  fontSize:"1.1rem", flexShrink:0, width:32, height:32,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  background:c.badge, borderRadius:8,
                }}>
                  {SECTION_ICONS[i % SECTION_ICONS.length]}
                </span>
                <div style={{ flex:1 }}>
                  <p style={{ fontWeight:700, fontSize:"0.82rem", color:c.text, lineHeight:1.3 }}>{sec.title}</p>
                  <p style={{ fontSize:"0.68rem", color:"var(--text-muted)", marginTop:2 }}>
                    {items.length} concepts {isOpen ? "▲" : "▼"}
                  </p>
                </div>
              </div>

              {/* Subsection chips — always show first 3 */}
              <div style={{ display:"flex", flexWrap:"wrap", gap:".3rem" }}>
                {(isOpen ? items : items.slice(0,3)).map((item,j)=>(
                  <span key={j} style={{
                    fontSize:"0.65rem", padding:"0.2rem 0.5rem", borderRadius:99,
                    background: j < sec.subsections.length ? c.badge : "rgba(255,255,255,0.05)",
                    border:`1px solid ${j < sec.subsections.length ? c.border+"66" : "rgba(255,255,255,0.1)"}`,
                    color: j < sec.subsections.length ? c.text : "var(--text-secondary)",
                    lineHeight:1.4,
                  }}>
                    {j < sec.subsections.length ? "◆ " : "· "}{item.slice(0,55)}{item.length>55?"…":""}
                  </span>
                ))}
                {!isOpen && items.length > 3 && (
                  <span style={{ fontSize:"0.65rem", padding:"0.2rem 0.5rem", borderRadius:99,
                    background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)",
                    color:"var(--text-muted)" }}>
                    +{items.length-3} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p style={{ textAlign:"center", fontSize:"0.7rem", color:"var(--text-muted)" }}>
        Click any card to expand · Colors represent topic branches
      </p>
    </div>
  );
}
