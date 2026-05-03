import { useEffect, useRef, useState } from "react";
import { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { Metronome } from "./metronome";
import { PianoRoll, PRNote } from "./PianoRoll";

type Phase = "idle" | "recording" | "recording-audio" | "stopped";

const GRID_OPTIONS = [
  { label: "Quarter", value: "1", snap: 1.0 },
  { label: "8th", value: "1/2", snap: 0.5 },
  { label: "16th", value: "1/4", snap: 0.25 },
  { label: "32nd", value: "1/8", snap: 0.125 },
];

export function App() {
  const [devices, setDevices] = useState<string[]>([]);
  const [device, setDevice] = useState<string>("");
  const [transpositions, setTranspositions] = useState<string[]>([]);
  const [transposition, setTransposition] = useState("bb_tenor");
  const [tempo, setTempo] = useState(100);
  const [timeSig, setTimeSig] = useState("4/4");
  const [title, setTitle] = useState("MIDI Capture");
  const [phase, setPhase] = useState<Phase>("idle");
  const [noteCount, setNoteCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [metroOn, setMetroOn] = useState(true);
  const [metroVol, setMetroVol] = useState(50);
  const [countIn, setCountIn] = useState(true);
  const [debounceMs, setDebounceMs] = useState(30);
  const [busy, setBusy] = useState(false);
  const [qNotes, setQNotes] = useState<PRNote[]>([]);
  const [gridKey, setGridKey] = useState("1/4");
  const qNotesRef = useRef<PRNote[]>([]);

  const gridSnap = GRID_OPTIONS.find((g) => g.value === gridKey)?.snap ?? 0.25;

  const metroRef = useRef(new Metronome());
  const osmdRef = useRef<OpenSheetMusicDisplay | null>(null);
  const scoreDivRef = useRef<HTMLDivElement | null>(null);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetch("/api/devices")
      .then((r) => r.json())
      .then((d) => {
        setDevices(d.inputs);
        if (d.inputs[0]) setDevice(d.inputs[0]);
      })
      .catch(() => setError("Backend not reachable. Start the FastAPI server."));
    fetch("/api/transpositions")
      .then((r) => r.json())
      .then((d) => setTranspositions(d.options));
  }, []);

  useEffect(() => {
    if (scoreDivRef.current && !osmdRef.current) {
      osmdRef.current = new OpenSheetMusicDisplay(scoreDivRef.current, {
        autoResize: true,
        backend: "svg",
        drawTitle: true,
      });
    }
  }, []);

  const refreshDevices = async () => {
    const d = await fetch("/api/devices").then((r) => r.json());
    setDevices(d.inputs);
  };

  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const startRecording = async () => {
    setError(null);
    setBusy(true);
    try {
      const m = metroRef.current;
      m.bpm = tempo;
      const [a, b] = timeSig.split("/").map((x) => parseInt(x, 10));
      m.beatsPerBar = a || 4;
      void b;

      m.volume = metroVol / 100;
      if (metroOn) m.start();
      if (countIn) await wait((60 / tempo) * 1000 * m.beatsPerBar);

      const res = await fetch("/api/record/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ port_name: device || null, tempo_bpm: tempo, debounce_ms: debounceMs }),
      });
      if (!res.ok) throw new Error((await res.json()).detail || "Failed to start");
      setPhase("recording");
    } catch (e: any) {
      metroRef.current.stop();
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const updateNotes = (notes: PRNote[]) => {
    setQNotes(notes);
    qNotesRef.current = notes;
  };

  const stopRecording = async () => {
    setBusy(true);
    metroRef.current.stop();
    try {
      const res = await fetch("/api/record/stop", { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).detail || "Failed to stop");
      const data = await res.json();
      setPhase("stopped");
      setNoteCount(data.note_count);
      updateNotes(data.quantized);
      await renderScore(data.quantized);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const exportBody = () => ({
    transposition,
    time_sig: timeSig,
    title,
    tempo_bpm: tempo,
  });

  const renderScore = async (notesOverride?: PRNote[]) => {
    const notes = notesOverride ?? qNotesRef.current;
    try {
      const res = await fetch("/api/export/musicxml", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...exportBody(),
          notes: notes.length > 0 ? notes : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
        setError(err.detail || `Render failed (${res.status})`);
        return;
      }
      const xml = await res.text();
      if (osmdRef.current) {
        await osmdRef.current.load(xml);
        osmdRef.current.render();
      }
    } catch (e: any) {
      console.error("renderScore error:", e);
      setError(e.message || "Failed to render score");
    }
  };

  const downloadFile = async (kind: "musicxml" | "pdf") => {
    setError(null);
    const notes = qNotesRef.current;
    const res = await fetch(`/api/export/${kind}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...exportBody(),
        notes: notes.length > 0 ? notes : undefined,
      }),
    });
    if (!res.ok) {
      const detail = await res.json().catch(() => ({}));
      setError(detail.detail || `Export failed (${kind})`);
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = kind === "pdf" ? "score.pdf" : "score.musicxml";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRequantize = async (newGrid: string) => {
    setGridKey(newGrid);
    if (phase !== "stopped") return;
    try {
      const res = await fetch("/api/requantize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ grid: newGrid, tempo_bpm: tempo }),
      });
      if (!res.ok) return;
      const data = await res.json();
      updateNotes(data.quantized);
      await renderScore(data.quantized);
    } catch {
      // keep current notes
    }
  };

  // --- Audio input (mic recording + file upload) ---

  async function blobToWav(blob: Blob): Promise<Blob> {
    const ctx = new AudioContext();
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
    const ch = buf.getChannelData(0);
    const sr = buf.sampleRate;
    const out = new ArrayBuffer(44 + ch.length * 2);
    const v = new DataView(out);
    const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, "RIFF"); v.setUint32(4, 36 + ch.length * 2, true); w(8, "WAVE");
    w(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
    v.setUint16(22, 1, true); v.setUint32(24, sr, true);
    v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    w(36, "data"); v.setUint32(40, ch.length * 2, true);
    for (let i = 0; i < ch.length; i++) {
      const s = Math.max(-1, Math.min(1, ch[i]));
      v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    await ctx.close();
    return new Blob([out], { type: "audio/wav" });
  }

  async function sendAudioToBackend(wav: Blob) {
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("audio", wav, "recording.wav");
      fd.append("tempo_bpm", String(tempo));
      fd.append("grid", gridKey);
      const res = await fetch("/api/audio/convert", { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
        throw new Error(err.detail || "Audio conversion failed");
      }
      const data = await res.json();
      setPhase("stopped");
      setNoteCount(data.note_count);
      updateNotes(data.quantized);
      await renderScore(data.quantized);
    } catch (e: any) {
      setError(e.message);
      setPhase("idle");
    } finally {
      setBusy(false);
    }
  }

  const startAudioRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.start();
      mediaRecRef.current = mr;

      const m = metroRef.current;
      m.bpm = tempo;
      const [a] = timeSig.split("/").map((x) => parseInt(x, 10));
      m.beatsPerBar = a || 4;
      m.volume = metroVol / 100;
      if (metroOn) m.start();
      if (countIn) await wait((60 / tempo) * 1000 * m.beatsPerBar);

      setPhase("recording-audio");
    } catch (e: any) {
      setError(e.message || "Microphone access denied");
    }
  };

  const stopAudioRecording = async () => {
    metroRef.current.stop();
    const mr = mediaRecRef.current;
    if (!mr) return;
    await new Promise<void>((resolve) => { mr.onstop = () => resolve(); mr.stop(); });
    mr.stream.getTracks().forEach((t) => t.stop());
    const blob = new Blob(audioChunksRef.current);
    const wav = await blobToWav(blob);
    await sendAudioToBackend(wav);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (file.name.endsWith(".wav")) {
      await sendAudioToBackend(file);
    } else {
      const wav = await blobToWav(file);
      await sendAudioToBackend(wav);
    }
  };

  // Re-render score when transposition or settings change after a recording
  useEffect(() => {
    if (phase === "stopped" && qNotesRef.current.length > 0) void renderScore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transposition, timeSig, title, tempo]);

  const quartersPerMeasure = (() => {
    const [num, den] = timeSig.split("/").map((x) => parseInt(x, 10));
    return (num / den) * 4;
  })();

  return (
    <div className="app">
      <div className="app-header">
        <h1>MIDI → Notation</h1>
        <span className="subtitle">Yamaha YDS-150</span>
      </div>

      <div className="panel">
        <div className="panel-header">
          <h3>Settings</h3>
        </div>
        <div className="controls-grid">
          <label>
            MIDI Input
            <div className="row" style={{ gap: 6 }}>
              <select value={device} onChange={(e) => setDevice(e.target.value)} style={{ flex: 1 }}>
                {devices.length === 0 && <option value="">(none detected)</option>}
                {devices.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
              <button onClick={refreshDevices} disabled={busy} style={{ padding: "6px 10px", fontSize: 12 }}>↻</button>
            </div>
          </label>

          <label>
            Tempo (BPM)
            <input
              type="number"
              min={30}
              max={240}
              value={tempo}
              onChange={(e) => setTempo(parseInt(e.target.value || "100", 10))}
            />
          </label>

          <label>
            Time Signature
            <select value={timeSig} onChange={(e) => setTimeSig(e.target.value)}>
              {["2/4", "3/4", "4/4", "6/8"].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>

          <label>
            Transposition
            <select value={transposition} onChange={(e) => setTransposition(e.target.value)}>
              {transpositions.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>

          <label>
            Quantize
            <select value={gridKey} onChange={(e) => handleRequantize(e.target.value)}>
              {GRID_OPTIONS.map((g) => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
          </label>

          <label>
            Title
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
        </div>

        <div className="row" style={{ marginTop: 14, gap: 20 }}>
          <label className="inline">
            <input type="checkbox" checked={metroOn} onChange={(e) => setMetroOn(e.target.checked)} />
            Metronome
          </label>

          {metroOn && (
            <label>
              Volume
              <input
                type="range"
                min={0}
                max={100}
                value={metroVol}
                onChange={(e) => setMetroVol(parseInt(e.target.value, 10))}
                style={{ width: 100 }}
              />
            </label>
          )}

          <label className="inline">
            <input type="checkbox" checked={countIn} onChange={(e) => setCountIn(e.target.checked)} />
            Count-in
          </label>

          <label>
            Sensitivity
            <div className="row" style={{ gap: 6 }}>
              <input
                type="range"
                min={0}
                max={200}
                value={debounceMs}
                onChange={(e) => setDebounceMs(parseInt(e.target.value, 10))}
                style={{ width: 100 }}
              />
              <span style={{ fontSize: 11, color: "var(--text-dim)", minWidth: 36 }}>{debounceMs}ms</span>
            </div>
          </label>
        </div>
      </div>

      <div className="panel">
        <div className="row">
          {phase !== "recording" && phase !== "recording-audio" ? (
            <>
              <button className="primary" onClick={startRecording} disabled={busy || devices.length === 0}>
                Record MIDI
              </button>
              <button className="primary" onClick={startAudioRecording} disabled={busy} style={{ background: "var(--purple)", borderColor: "var(--purple)" }}>
                Record Audio
              </button>
              <button onClick={() => fileInputRef.current?.click()} disabled={busy}>
                Upload Audio
              </button>
              <input ref={fileInputRef} type="file" accept="audio/*" onChange={handleFileUpload} style={{ display: "none" }} />
            </>
          ) : phase === "recording" ? (
            <button className="danger" onClick={stopRecording} disabled={busy}>
              Stop MIDI
            </button>
          ) : (
            <button className="danger" onClick={stopAudioRecording} disabled={busy}>
              Stop Audio
            </button>
          )}

          <div className="divider" />

          <button onClick={() => downloadFile("musicxml")} disabled={phase !== "stopped" || busy}>
            MusicXML
          </button>
          <button onClick={() => downloadFile("pdf")} disabled={phase !== "stopped" || busy}>
            PDF
          </button>

          <span className={`status ${phase === "recording" || phase === "recording-audio" ? "recording" : ""}`}>
            {phase === "idle" && "Ready"}
            {phase === "recording" && "Recording MIDI..."}
            {phase === "recording-audio" && "Recording Audio..."}
            {phase === "stopped" && noteCount !== null && `${noteCount} notes captured`}
          </span>
        </div>
        {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}
      </div>

      {phase === "stopped" && qNotes.length > 0 && (
        <div className="panel piano-roll-container" style={{ padding: 0 }}>
          <PianoRoll
            notes={qNotes}
            onChange={(n) => updateNotes(n)}
            onEditEnd={() => void renderScore()}
            quartersPerMeasure={quartersPerMeasure}
            gridSize={gridSnap}
          />
        </div>
      )}

      <div className="panel score-panel">
        <h3>Notation</h3>
        <div className="score" ref={scoreDivRef} />
      </div>
    </div>
  );
}
