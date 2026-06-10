"use client";

import { useEffect, useRef } from "react";
import mermaid from "mermaid";

const GRADIENTS = [
  ["#7c3aed","#4c1d95"],
  ["#0891b2","#164e63"],
  ["#059669","#064e3b"],
  ["#c2410c","#431407"],
  ["#be185d","#500724"],
];

function extractMermaidBlocks(md: string): string[] {
  const blocks: string[] = [];
  let m: RegExpExecArray | null;
  const re = /```mermaid\n([\s\S]*?)```/g;
  while ((m = re.exec(md))) blocks.push(m[1].trim());
  return blocks;
}

function sanitize(code: string): string {
  const UNSAFE = /["&<>()?,:/]/;
  const makeLabel = (b: string) =>
    '"' + b.replace(/"/g,"'").replace(/\(([^)]*)\)/g," $1 ")
           .replace(/&/g," and ").replace(/</g,"lt").replace(/>/g,"gt")
           .replace(/:/g," -").replace(/\//g," or ").replace(/\s+/g," ").trim() + '"';
  const cleanQ = (q: string) => {
    const i = q.slice(1,-1).replace(/\(([^)]*)\)/g," $1 ").replace(/&/g," and ")
               .replace(/:/g," -").replace(/\//g," or ").replace(/\s+/g," ").trim();
    return `"${i}"`;
  };
  return code
    .replace(/\{([^{}\n]+)\}/g,(_,b)=>{
      const t=b.trim();
      return `{${t.startsWith('"')&&t.endsWith('"')?cleanQ(t):makeLabel(b)}}`;
    })
    .replace(/\[([^\][\n]+)\]/g,(_,b)=>{
      const t=b.trim();
      if(t.startsWith('"')&&t.endsWith('"')) return UNSAFE.test(t)?`[${cleanQ(t)}]`:`[${b}]`;
      return UNSAFE.test(b)?`[${makeLabel(b)}]`:`[${b}]`;
    });
}

/** Inject gradient defs + coloured fills into a rendered mermaid SVG element */
function colorizeSvg(svg: SVGElement) {
  const ns = "http://www.w3.org/2000/svg";

  // Build <defs> with gradient + glow filter
  let defs = svg.querySelector("defs");
  if (!defs) { defs = document.createElementNS(ns,"defs"); svg.prepend(defs); }

  // Glow filter
  const filter = document.createElementNS(ns,"filter");
  filter.id = "nx-glow"; filter.innerHTML = `
    <feGaussianBlur stdDeviation="3" result="blur"/>
    <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>`;
  defs.appendChild(filter);

  // Gradient per colour
  GRADIENTS.forEach(([from,to],i)=>{
    const g = document.createElementNS(ns,"linearGradient");
    g.id=`nx-grad-${i}`; g.setAttribute("x1","0%"); g.setAttribute("y1","0%");
    g.setAttribute("x2","100%"); g.setAttribute("y2","100%");
    const s1=document.createElementNS(ns,"stop"); s1.setAttribute("offset","0%"); s1.setAttribute("stop-color",from);
    const s2=document.createElementNS(ns,"stop"); s2.setAttribute("offset","100%"); s2.setAttribute("stop-color",to);
    g.append(s1,s2); defs!.appendChild(g);
  });

  // Paint rectangles (process nodes)
  const rects = svg.querySelectorAll<SVGRectElement>("rect:not(.label)");
  rects.forEach((r,i)=>{
    const gi = i % GRADIENTS.length;
    r.setAttribute("fill",`url(#nx-grad-${gi})`);
    r.setAttribute("stroke", GRADIENTS[gi][0]);
    r.setAttribute("stroke-width","1.5");
    r.setAttribute("rx","8"); r.setAttribute("ry","8");
  });

  // Paint polygons (decision diamonds)
  svg.querySelectorAll<SVGPolygonElement>("polygon").forEach((p,i)=>{
    const gi = (i+2) % GRADIENTS.length;
    p.setAttribute("fill",`url(#nx-grad-${gi})`);
    p.setAttribute("stroke",GRADIENTS[gi][0]);
    p.setAttribute("stroke-width","1.5");
  });

  // Glow on edges
  svg.querySelectorAll<SVGPathElement>("path.flowchart-link, path.relation").forEach(p=>{
    p.setAttribute("stroke","#7c3aed");
    p.setAttribute("stroke-width","2");
    p.setAttribute("filter","url(#nx-glow)");
    p.setAttribute("opacity","0.9");
  });

  // Make all text readable
  svg.querySelectorAll<SVGTextElement>("text, tspan").forEach(t=>{
    t.setAttribute("fill","#f1f5f9");
    t.style.fontFamily = "Inter, sans-serif";
    t.style.fontSize = "12px";
  });
}

mermaid.initialize({
  startOnLoad: false,
  theme: "dark",
  themeVariables: {
    darkMode: true,
    background: "#0a0a12",
    primaryColor: "#1e1b4b",
    primaryTextColor: "#f1f5f9",
    primaryBorderColor: "#7c3aed",
    lineColor: "#7c3aed",
    secondaryColor: "#0c4a6e",
    tertiaryColor: "#0f172a",
  },
});

export default function DiagramView({ markdown }: { markdown: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const blocks = extractMermaidBlocks(markdown);

  useEffect(() => {
    if (!containerRef.current || blocks.length === 0) return;
    containerRef.current.innerHTML = "";

    blocks.forEach(async (block, idx) => {
      const sanitized = sanitize(block);
      const wrapper = document.createElement("div");
      wrapper.style.cssText = "margin-bottom:2rem;position:relative;";

      // Label badge
      const badge = document.createElement("div");
      badge.innerHTML = `<span style="font-size:0.68rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#a78bfa;background:rgba(124,58,237,0.15);border:1px solid rgba(124,58,237,0.3);padding:.2rem .7rem;border-radius:99px;">⬡ Flow ${idx+1}</span>`;
      badge.style.marginBottom = ".75rem";
      wrapper.appendChild(badge);

      const host = document.createElement("div");
      host.style.cssText = "background:rgba(0,0,0,0.4);border:1px solid rgba(124,58,237,0.2);border-radius:16px;padding:1.5rem;overflow:auto;";
      wrapper.appendChild(host);
      containerRef.current!.appendChild(wrapper);

      try {
        const id = `nx-mmd-${idx}-${Date.now()}`;
        const { svg } = await mermaid.render(id, sanitized);
        host.innerHTML = svg;

        // Post-process: colorize the rendered SVG
        const svgEl = host.querySelector<SVGElement>("svg");
        if (svgEl) {
          svgEl.style.cssText = "width:100%;max-width:100%;height:auto;";
          colorizeSvg(svgEl);
        }
      } catch (e) {
        host.innerHTML = `
          <div style="border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:1rem;">
            <p style="color:#f87171;font-size:.78rem;margin-bottom:.5rem">⚠ Could not render diagram — source:</p>
            <pre style="color:#94a3b8;font-size:.72rem;overflow-x:auto;white-space:pre-wrap">${sanitized.replace(/</g,"&lt;")}</pre>
          </div>`;
      }
    });
  }, [markdown]);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:".75rem" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <p style={{ fontSize:".7rem", fontWeight:700, color:"var(--text-muted)", letterSpacing:".08em", textTransform:"uppercase" }}>
          Process Flows ({blocks.length} found)
        </p>
        {blocks.length > 0 && (
          <span style={{ fontSize:".68rem", color:"#a78bfa", background:"rgba(124,58,237,0.1)", padding:".15rem .5rem", borderRadius:99, border:"1px solid rgba(124,58,237,0.2)" }}>
            ✦ AI-generated
          </span>
        )}
      </div>

      {blocks.length === 0 ? (
        <div style={{ textAlign:"center", padding:"3rem", color:"var(--text-muted)" }}>
          <p style={{ fontSize:"2rem", marginBottom:".5rem" }}>📊</p>
          <p>No process flows detected in this lecture.</p>
          <p style={{ fontSize:".78rem", marginTop:".25rem" }}>Gemini generates these when it finds step-by-step processes or workflows.</p>
        </div>
      ) : (
        <div ref={containerRef} id="diagram-container" />
      )}
    </div>
  );
}
