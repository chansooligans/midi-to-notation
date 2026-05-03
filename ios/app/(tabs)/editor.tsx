import { useCallback, useMemo, useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from "react-native";
import { Canvas, useCanvasRef, Rect, RoundedRect, Line, Text as SkiaText, useFont, vec } from "@shopify/react-native-skia";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useAppState } from "../../src/hooks/useAppState";
import { PRNote } from "../../src/api/types";

const ROW_H = 24;
const LABEL_W = 52;
const HEADER_H = 28;
const BASE_PX_Q = 100;
const HANDLE_W = 10;

const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const NATURALS = new Set([0, 2, 4, 5, 7, 9, 11]);
function noteName(m: number) { return NAMES[m % 12] + (Math.floor(m / 12) - 1); }
function isNat(m: number) { return NATURALS.has(m % 12); }

export default function EditorScreen() {
  const { quantizedNotes, setQuantizedNotes, selectedIndices, setSelectedIndices, settings } = useAppState();
  const [zoom, setZoom] = useState(1.0);
  const notes = quantizedNotes;
  const gridSize = settings.gridSnap;
  const quartersPerMeasure = parseInt(settings.timeSig.split("/")[0], 10) || 4;

  const snap = useCallback(
    (t: number) => Math.max(0, Math.round(t / gridSize) * gridSize),
    [gridSize],
  );

  const pxQ = BASE_PX_Q * zoom;

  const { minP, maxP, endQ, rows } = useMemo(() => {
    if (notes.length === 0) return { minP: 57, maxP: 81, endQ: 8, rows: 25 };
    const pitches = notes.map((n) => n.pitch);
    const mn = Math.min(...pitches) - 4;
    const mx = Math.max(...pitches) + 4;
    const eq = Math.max(...notes.map((n) => n.start + n.duration)) + 4;
    return { minP: mn, maxP: mx, endQ: eq, rows: mx - mn + 1 };
  }, [notes]);

  const W = LABEL_W + Math.ceil(endQ) * pxQ + 60;
  const H = HEADER_H + rows * ROW_H;

  const pToY = useCallback((p: number) => HEADER_H + (maxP - p) * ROW_H, [maxP]);
  const tToX = useCallback((t: number) => LABEL_W + t * pxQ, [pxQ]);

  const hitTest = useCallback(
    (mx: number, my: number) => {
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
    },
    [notes, tToX, pToY, pxQ],
  );

  // Gesture handling
  const dragOrigin = useRef<{ idx: number; startX: number; startY: number; orig: PRNote } | null>(null);

  const tapGesture = Gesture.Tap().onEnd((e) => {
    const hit = hitTest(e.x, e.y);
    if (hit) {
      const newSel = new Set<number>();
      newSel.add(hit.idx);
      setSelectedIndices(newSel);
    } else {
      setSelectedIndices(new Set());
    }
  });

  const longPressGesture = Gesture.LongPress().onStart((e) => {
    const hit = hitTest(e.x, e.y);
    if (hit) {
      const newSel = new Set(selectedIndices);
      if (newSel.has(hit.idx)) newSel.delete(hit.idx);
      else newSel.add(hit.idx);
      setSelectedIndices(newSel);
    }
  });

  const panGesture = Gesture.Pan()
    .onStart((e) => {
      const hit = hitTest(e.x, e.y);
      if (hit && selectedIndices.has(hit.idx)) {
        dragOrigin.current = {
          idx: hit.idx,
          startX: e.x,
          startY: e.y,
          orig: { ...notes[hit.idx] },
        };
      }
    })
    .onUpdate((e) => {
      if (!dragOrigin.current) return;
      const { idx, startX, startY, orig } = dragOrigin.current;
      const dx = e.x - startX;
      const dy = e.y - startY;
      const updated = [...notes];
      updated[idx] = {
        ...orig,
        start: snap(orig.start + dx / pxQ),
        pitch: Math.max(0, Math.min(127, orig.pitch - Math.round(dy / ROW_H))),
      };
      setQuantizedNotes(updated);
    })
    .onEnd(() => {
      dragOrigin.current = null;
    });

  const pinchGesture = Gesture.Pinch().onUpdate((e) => {
    setZoom((z) => Math.max(0.3, Math.min(4, z * e.scale)));
  });

  const composedGesture = Gesture.Race(
    pinchGesture,
    Gesture.Exclusive(longPressGesture, tapGesture, panGesture),
  );

  const deleteSelected = useCallback(() => {
    if (selectedIndices.size === 0) return;
    setQuantizedNotes(notes.filter((_, i) => !selectedIndices.has(i)));
    setSelectedIndices(new Set());
  }, [notes, selectedIndices, setQuantizedNotes, setSelectedIndices]);

  const snapSelected = useCallback(() => {
    const updated = notes.map((n, i) =>
      selectedIndices.has(i)
        ? { ...n, start: snap(n.start), duration: Math.max(gridSize, snap(n.duration)) }
        : n,
    );
    setQuantizedNotes(updated);
  }, [notes, selectedIndices, snap, gridSize, setQuantizedNotes]);

  if (notes.length === 0) {
    return (
      <View style={s.empty}>
        <Text style={s.emptyIcon}>🎹</Text>
        <Text style={s.emptyText}>No notes to edit</Text>
        <Text style={s.emptyHint}>Record MIDI or audio first</Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      {/* Toolbar */}
      <View style={s.toolbar}>
        <TouchableOpacity style={s.tbtn} onPress={() => setZoom((z) => Math.min(4, z + 0.25))}>
          <Text style={s.tbtnText}>+</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.tbtn} onPress={() => setZoom((z) => Math.max(0.3, z - 0.25))}>
          <Text style={s.tbtnText}>−</Text>
        </TouchableOpacity>
        <Text style={s.zoomLabel}>{Math.round(zoom * 100)}%</Text>

        {selectedIndices.size > 0 && (
          <>
            <View style={s.divider} />
            <TouchableOpacity style={s.tbtn} onPress={snapSelected}>
              <Text style={s.tbtnText}>Snap</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.tbtn, { backgroundColor: "#e74c3c33" }]} onPress={deleteSelected}>
              <Text style={[s.tbtnText, { color: "#e74c3c" }]}>Delete</Text>
            </TouchableOpacity>
            <Text style={s.selLabel}>{selectedIndices.size} selected</Text>
          </>
        )}
      </View>

      {/* Piano Roll Canvas */}
      <GestureDetector gesture={composedGesture}>
        <Canvas style={{ width: Math.min(W, Dimensions.get("window").width), height: Math.min(H, 500) }}>
          {/* Background */}
          <Rect x={0} y={0} width={W} height={H} color="#1a1a2e" />

          {/* Row backgrounds */}
          {Array.from({ length: rows }, (_, r) => {
            const p = maxP - r;
            return (
              <Rect
                key={`row-${r}`}
                x={LABEL_W}
                y={HEADER_H + r * ROW_H}
                width={W - LABEL_W}
                height={ROW_H}
                color={isNat(p) ? "#1e1e36" : "#16162a"}
              />
            );
          })}

          {/* Notes */}
          {notes.map((n, i) => {
            const x = tToX(n.start);
            const y = pToY(n.pitch) + 1;
            const w = Math.max(n.duration * pxQ, 4);
            const h = ROW_H - 2;
            const isSel = selectedIndices.has(i);
            return (
              <RoundedRect
                key={`note-${i}`}
                x={x}
                y={y}
                width={w}
                height={h}
                r={3}
                color={isSel ? "#ff8c42" : "#4a9eff"}
              />
            );
          })}

          {/* Header */}
          <Rect x={0} y={0} width={W} height={HEADER_H} color="#2a2a40" />
          <Rect x={0} y={HEADER_H} width={LABEL_W} height={H - HEADER_H} color="#262640" />
        </Canvas>
      </GestureDetector>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1a1a2e" },
  toolbar: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    backgroundColor: "#262640", borderBottomWidth: 1, borderBottomColor: "#333",
  },
  tbtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6,
    backgroundColor: "#333", borderWidth: 1, borderColor: "#444",
  },
  tbtnText: { color: "#ccc", fontSize: 14 },
  zoomLabel: { color: "#888", fontSize: 12, minWidth: 40 },
  divider: { width: 1, height: 20, backgroundColor: "#444" },
  selLabel: { color: "#666", fontSize: 12, marginLeft: "auto" },
  empty: { flex: 1, backgroundColor: "#1a1a2e", justifyContent: "center", alignItems: "center" },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: "#888", fontSize: 18 },
  emptyHint: { color: "#555", fontSize: 14, marginTop: 4 },
});
