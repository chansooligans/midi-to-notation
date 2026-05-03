import { useCallback, useEffect, useRef, useState } from "react";

export interface PRNote {
  pitch: number;
  velocity: number;
  start: number;
  duration: number;
}

interface Props {
  notes: PRNote[];
  onChange: (notes: PRNote[]) => void;
  onEditEnd: () => void;
  quartersPerMeasure: number;
  gridSize: number;
}

const BASE_PX_Q = 120;
const ROW_H = 20;
const LABEL_W = 52;
const HEADER_H = 28;
const HANDLE_W = 8;

const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NATURALS = new Set([0, 2, 4, 5, 7, 9, 11]);
function noteName(m: number) { return NAMES[m % 12] + (Math.floor(m / 12) - 1); }
function isNat(m: number) { return NATURALS.has(m % 12); }

type DragState =
  | { type: "move" | "resize"; indices: number[]; startX: number; startY: number; origNotes: Map<number, PRNote> }
  | { type: "marquee"; x0: number; y0: number; additive: boolean }
  | null;

export function PianoRoll({ notes, onChange, onEditEnd, quartersPerMeasure, gridSize }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [zoom, setZoom] = useState(1.0);
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const dragRef = useRef<DragState>(null);

  const pxQ = BASE_PX_Q * zoom;
  const snap = useCallback(
    (t: number) => Math.max(0, Math.round(t / gridSize) * gridSize),
    [gridSize],
  );

  useEffect(() => {
    setSelected((prev) => {
      const next = new Set<number>();
      prev.forEach((i) => { if (i < notes.length) next.add(i); });
      return next.size !== prev.size ? next : prev;
    });
  }, [notes.length]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const d = e.deltaY > 0 ? -0.15 : 0.15;
        setZoom((z) => Math.max(0.3, Math.min(4, z + d)));
      }
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  const minP = notes.length ? Math.min(...notes.map((n) => n.pitch)) - 4 : 57;
  const maxP = notes.length ? Math.max(...notes.map((n) => n.pitch)) + 4 : 81;
  const endQ = notes.length ? Math.max(...notes.map((n) => n.start + n.duration)) + 4 : 8;
  const rows = maxP - minP + 1;
  const W = LABEL_W + Math.ceil(endQ) * pxQ + 60;
  const H = HEADER_H + rows * ROW_H;

  const pToY = useCallback((p: number) => HEADER_H + (maxP - p) * ROW_H, [maxP]);
  const tToX = useCallback((t: number) => LABEL_W + t * pxQ, [pxQ]);

  const draw = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    c.width = W * dpr;
    c.height = H * dpr;
    c.style.width = W + "px";
    c.style.height = H + "px";
    ctx.scale(dpr, dpr);

    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, W, H);

    for (let p = minP; p <= maxP; p++) {
      ctx.fillStyle = isNat(p) ? "#1e1e36" : "#16162a";
      ctx.fillRect(LABEL_W, pToY(p), W - LABEL_W, ROW_H);
    }

    const totalQ = Math.ceil(endQ);
    for (let q = 0; q <= totalQ; q += gridSize) {
      const x = tToX(q);
      const frac = q / quartersPerMeasure;
      const isMeasure = Math.abs(frac - Math.round(frac)) < 0.001;
      const isBeat = Math.abs(q - Math.round(q)) < 0.001;
      ctx.strokeStyle = isMeasure ? "#3a3a5a" : isBeat ? "#2a2a4a" : "#222240";
      ctx.lineWidth = isMeasure ? 1.5 : isBeat ? 1 : 0.5;
      ctx.beginPath();
      ctx.moveTo(x, HEADER_H);
      ctx.lineTo(x, H);
      ctx.stroke();
    }

    for (let p = minP; p <= maxP + 1; p++) {
      ctx.strokeStyle = "#222240";
      ctx.lineWidth = p % 12 === 0 ? 1.5 : 0.5;
      ctx.beginPath();
      ctx.moveTo(LABEL_W, pToY(p) + ROW_H);
      ctx.lineTo(W, pToY(p) + ROW_H);
      ctx.stroke();
    }

    ctx.fillStyle = "#2a2a40";
    ctx.fillRect(0, 0, W, HEADER_H);
    ctx.font = "12px -apple-system, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#aaa";
    for (let q = 0; q < totalQ; q += quartersPerMeasure) {
      const m = Math.round(q / quartersPerMeasure) + 1;
      ctx.fillText(String(m), tToX(q) + (quartersPerMeasure * pxQ) / 2, 18);
    }

    ctx.fillStyle = "#262640";
    ctx.fillRect(0, HEADER_H, LABEL_W, H - HEADER_H);
    ctx.textAlign = "right";
    ctx.font = "11px monospace";
    for (let p = minP; p <= maxP; p++) {
      ctx.fillStyle = isNat(p) ? "#bbb" : "#666";
      ctx.fillText(noteName(p), LABEL_W - 6, pToY(p) + ROW_H / 2 + 4);
    }

    notes.forEach((n, i) => {
      const x = tToX(n.start);
      const y = pToY(n.pitch) + 1;
      const w = Math.max(n.duration * pxQ, 4);
      const h = ROW_H - 2;
      const isSel = selected.has(i);
      ctx.fillStyle = isSel ? "#ff8c42" : "#4a9eff";
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 3);
      ctx.fill();
      ctx.strokeStyle = isSel ? "rgba(255,200,100,0.5)" : "rgba(0,0,0,0.3)";
      ctx.lineWidth = isSel ? 1.5 : 0.5;
      ctx.stroke();
      if (w > HANDLE_W * 3) {
        ctx.fillStyle = "rgba(255,255,255,0.12)";
        ctx.fillRect(x + w - HANDLE_W, y, HANDLE_W, h);
      }
    });

    // marquee overlay
    if (marquee) {
      const mx = Math.min(marquee.x0, marquee.x1);
      const my = Math.min(marquee.y0, marquee.y1);
      const mw = Math.abs(marquee.x1 - marquee.x0);
      const mh = Math.abs(marquee.y1 - marquee.y0);
      ctx.fillStyle = "rgba(74, 154, 255, 0.12)";
      ctx.fillRect(mx, my, mw, mh);
      ctx.strokeStyle = "rgba(74, 154, 255, 0.6)";
      ctx.lineWidth = 1;
      ctx.strokeRect(mx, my, mw, mh);
    }
  }, [notes, selected, marquee, W, H, minP, maxP, endQ, quartersPerMeasure, gridSize, pToY, tToX, pxQ]);

  useEffect(() => { draw(); }, [draw]);

  const hitTest = (mx: number, my: number) => {
    for (let i = notes.length - 1; i >= 0; i--) {
      const n = notes[i];
      const x = tToX(n.start);
      const y = pToY(n.pitch);
      const w = Math.max(n.duration * pxQ, 4);
      if (mx >= x && mx <= x + w && my >= y && my <= y + ROW_H) {
        return { idx: i, isResize: mx >= x + w - HANDLE_W && w > HANDLE_W * 3 };
      }
    }
    return null;
  };

  const notesInRect = (x0: number, y0: number, x1: number, y1: number): Set<number> => {
    const left = Math.min(x0, x1);
    const right = Math.max(x0, x1);
    const top = Math.min(y0, y1);
    const bottom = Math.max(y0, y1);
    const result = new Set<number>();
    notes.forEach((n, i) => {
      const nx = tToX(n.start);
      const ny = pToY(n.pitch);
      const nw = Math.max(n.duration * pxQ, 4);
      if (nx + nw > left && nx < right && ny + ROW_H > top && ny < bottom) {
        result.add(i);
      }
    });
    return result;
  };

  const onMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const hit = hitTest(mx, my);

    if (hit) {
      const multi = e.shiftKey || e.metaKey || e.ctrlKey;
      let newSel: Set<number>;
      if (multi) {
        newSel = new Set(selected);
        if (newSel.has(hit.idx)) newSel.delete(hit.idx); else newSel.add(hit.idx);
      } else if (!selected.has(hit.idx)) {
        newSel = new Set([hit.idx]);
      } else {
        newSel = selected;
      }
      setSelected(newSel);

      const indices = hit.isResize ? [hit.idx] : [...newSel];
      const origNotes = new Map<number, PRNote>();
      indices.forEach((i) => origNotes.set(i, { ...notes[i] }));
      dragRef.current = {
        type: hit.isResize ? "resize" : "move",
        indices,
        startX: e.clientX,
        startY: e.clientY,
        origNotes,
      };
      e.preventDefault();
    } else if (my > HEADER_H && mx > LABEL_W) {
      // start marquee selection
      const additive = e.shiftKey || e.metaKey || e.ctrlKey;
      if (!additive) setSelected(new Set());
      dragRef.current = { type: "marquee", x0: mx, y0: my, additive };
      setMarquee({ x0: mx, y0: my, x1: mx, y1: my });
      e.preventDefault();
    } else {
      setSelected(new Set());
    }
  };

  const onMouseMove = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const d = dragRef.current;

    if (!d) {
      const hit = hitTest(mx, my);
      canvasRef.current!.style.cursor = hit ? (hit.isResize ? "ew-resize" : "grab") : "crosshair";
      return;
    }

    if (d.type === "marquee") {
      canvasRef.current!.style.cursor = "crosshair";
      setMarquee({ x0: d.x0, y0: d.y0, x1: mx, y1: my });
      // live preview: show which notes would be selected
      const inRect = notesInRect(d.x0, d.y0, mx, my);
      if (d.additive) {
        const merged = new Set(selected);
        inRect.forEach((i) => merged.add(i));
        setSelected(merged);
      } else {
        setSelected(inRect);
      }
      return;
    }

    canvasRef.current!.style.cursor = d.type === "resize" ? "ew-resize" : "grabbing";

    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    const updated = [...notes];
    for (const idx of d.indices) {
      const orig = d.origNotes.get(idx)!;
      if (d.type === "move") {
        updated[idx] = {
          ...orig,
          start: snap(orig.start + dx / pxQ),
          pitch: Math.max(0, Math.min(127, orig.pitch - Math.round(dy / ROW_H))),
        };
      } else {
        updated[idx] = {
          ...orig,
          duration: Math.max(gridSize, snap(orig.duration + dx / pxQ)),
        };
      }
    }
    onChange(updated);
  };

  const onMouseUp = () => {
    const d = dragRef.current;
    if (!d) return;

    if (d.type === "marquee") {
      setMarquee(null);
    } else {
      onEditEnd();
    }
    dragRef.current = null;
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === "Delete" || e.key === "Backspace") && selected.size > 0) {
      const rem = selected;
      onChange(notes.filter((_, i) => !rem.has(i)));
      setSelected(new Set());
      onEditEnd();
      e.preventDefault();
    }
  };

  const handleSnapSelected = () => {
    const updated = notes.map((n, i) =>
      selected.has(i)
        ? { ...n, start: snap(n.start), duration: Math.max(gridSize, snap(n.duration)) }
        : n,
    );
    onChange(updated);
    onEditEnd();
  };

  const tb: React.CSSProperties = {
    background: "#333", color: "#ccc", border: "1px solid #444",
    borderRadius: 4, padding: "2px 10px", cursor: "pointer", fontSize: 13,
  };

  return (
    <div>
      <div style={{
        display: "flex", gap: 8, alignItems: "center",
        padding: "6px 16px", background: "#262640", borderBottom: "1px solid #333",
      }}>
        <button onClick={() => setZoom((z) => Math.min(4, z + 0.25))} style={tb}>+</button>
        <button onClick={() => setZoom((z) => Math.max(0.3, z - 0.25))} style={tb}>−</button>
        <span style={{ fontSize: 11, color: "#888", minWidth: 36 }}>{Math.round(zoom * 100)}%</span>

        {selected.size > 0 && (
          <>
            <div style={{ width: 1, height: 18, background: "#444" }} />
            <button onClick={handleSnapSelected} style={tb}>Snap Selected to Grid</button>
          </>
        )}

        <span style={{ fontSize: 11, color: "#666", marginLeft: "auto" }}>
          {selected.size > 0
            ? `${selected.size} selected · Delete to remove`
            : "click to select · drag empty area to lasso"}
          {" · ctrl+scroll to zoom"}
        </span>
      </div>
      <div
        ref={wrapRef}
        style={{ overflowX: "auto", overflowY: "auto", maxHeight: 520 }}
        tabIndex={0}
        onKeyDown={onKeyDown}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          style={{ display: "block" }}
        />
      </div>
    </div>
  );
}
