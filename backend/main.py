"""FastAPI app: MIDI capture, notation generation, MusicXML/PDF export."""
from __future__ import annotations

import tempfile
from fractions import Fraction
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel, Field

from midi_capture import MidiRecorder, NoteEvent
from notation import TRANSPOSITIONS, QuantizedNote, quantize_events, quantized_to_score

app = FastAPI(title="MIDI to Notation")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

recorder = MidiRecorder()
_last_recording: dict = {"events": [], "quantized": [], "tempo": 100.0}

GRID_MAP = {
    "1": Fraction(1),
    "1/2": Fraction(1, 2),
    "1/4": Fraction(1, 4),
    "1/8": Fraction(1, 8),
}


class StartRequest(BaseModel):
    port_name: Optional[str] = None
    tempo_bpm: float = Field(100.0, gt=20, lt=300)
    debounce_ms: float = Field(30, ge=0, le=200)


class ExportRequest(BaseModel):
    transposition: str = "bb_tenor"
    time_sig: str = "4/4"
    title: str = "MIDI Capture"
    tempo_bpm: Optional[float] = None
    notes: Optional[list[dict]] = None


class QuantizeRequest(BaseModel):
    events: list[dict]
    tempo_bpm: float = 100.0
    grid: str = "1/4"


class RequantizeRequest(BaseModel):
    grid: str = "1/4"
    tempo_bpm: Optional[float] = None


def _notes_to_quantized(notes: list[dict]) -> list[QuantizedNote]:
    return [
        QuantizedNote(
            pitch=n["pitch"],
            velocity=n.get("velocity", 80),
            start=Fraction(n["start"]).limit_denominator(128),
            duration=Fraction(n["duration"]).limit_denominator(128),
        )
        for n in notes
    ]


@app.get("/api/devices")
def list_devices() -> dict:
    return {"inputs": MidiRecorder.list_inputs()}


@app.get("/api/transpositions")
def list_transpositions() -> dict:
    return {"options": list(TRANSPOSITIONS.keys())}


@app.post("/api/record/start")
def start_record(req: StartRequest) -> dict:
    try:
        rec = recorder.start(req.port_name, req.tempo_bpm, req.debounce_ms)
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"status": "recording", "tempo_bpm": rec.tempo_bpm}


@app.post("/api/record/stop")
def stop_record() -> dict:
    try:
        rec = recorder.stop()
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))
    _last_recording["events"] = [
        {"pitch": e.pitch, "velocity": e.velocity, "start": e.start, "duration": e.duration}
        for e in rec.events
    ]
    _last_recording["tempo"] = rec.tempo_bpm

    quantized = quantize_events(rec.events, rec.tempo_bpm)
    _last_recording["quantized"] = [
        {"pitch": q.pitch, "velocity": q.velocity,
         "start": float(q.start), "duration": float(q.duration)}
        for q in quantized
    ]

    return {
        "status": "stopped",
        "note_count": len(rec.events),
        "quantized_count": len(quantized),
        "tempo_bpm": rec.tempo_bpm,
        "events": _last_recording["events"],
        "quantized": _last_recording["quantized"],
    }


@app.post("/api/quantize")
def quantize_raw(req: QuantizeRequest) -> dict:
    grid = GRID_MAP.get(req.grid, Fraction(1, 4))
    raw = [NoteEvent(**e) for e in req.events]
    quantized = quantize_events(raw, req.tempo_bpm, grid=grid)
    result = [
        {"pitch": q.pitch, "velocity": q.velocity,
         "start": float(q.start), "duration": float(q.duration)}
        for q in quantized
    ]
    return {"quantized": result, "count": len(result)}


@app.post("/api/requantize")
def requantize(req: RequantizeRequest) -> dict:
    if not _last_recording["events"]:
        raise HTTPException(status_code=400, detail="No recording available.")
    grid = GRID_MAP.get(req.grid, Fraction(1, 4))
    tempo = req.tempo_bpm or _last_recording["tempo"]
    raw = [NoteEvent(**e) for e in _last_recording["events"]]
    quantized = quantize_events(raw, tempo, grid=grid)
    result = [
        {"pitch": q.pitch, "velocity": q.velocity,
         "start": float(q.start), "duration": float(q.duration)}
        for q in quantized
    ]
    _last_recording["quantized"] = result
    return {"quantized": result, "count": len(result)}


@app.post("/api/audio/convert")
async def convert_audio(
    audio: UploadFile,
    tempo_bpm: float = Form(100),
    grid: str = Form("1/4"),
) -> dict:
    from audio_convert import audio_to_events
    audio_bytes = await audio.read()
    try:
        events = audio_to_events(audio_bytes)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Audio processing failed: {e}")

    grid_frac = GRID_MAP.get(grid, Fraction(1, 4))
    quantized = quantize_events(events, tempo_bpm, grid=grid_frac)

    raw = [{"pitch": e.pitch, "velocity": e.velocity, "start": e.start, "duration": e.duration}
           for e in events]
    q_list = [{"pitch": q.pitch, "velocity": q.velocity,
               "start": float(q.start), "duration": float(q.duration)}
              for q in quantized]

    _last_recording["events"] = raw
    _last_recording["quantized"] = q_list
    _last_recording["tempo"] = tempo_bpm

    return {
        "note_count": len(events),
        "quantized_count": len(quantized),
        "quantized": q_list,
    }


def _build_score(req: ExportRequest):
    tempo_bpm = req.tempo_bpm or _last_recording["tempo"]

    if req.notes is not None:
        quantized = _notes_to_quantized(req.notes)
    elif not _last_recording["quantized"]:
        raise HTTPException(status_code=400, detail="No recording available. Record first.")
    else:
        quantized = _notes_to_quantized(_last_recording["quantized"])

    return quantized_to_score(
        quantized,
        tempo_bpm=tempo_bpm,
        transposition=req.transposition,
        time_sig=req.time_sig,
        title=req.title,
    )


@app.post("/api/export/musicxml")
def export_musicxml(req: ExportRequest) -> Response:
    score = _build_score(req)
    with tempfile.NamedTemporaryFile(suffix=".musicxml", delete=False) as f:
        path = Path(f.name)
    try:
        score.write("musicxml", fp=str(path))
        data = path.read_bytes()
    finally:
        try:
            path.unlink()
        except OSError:
            pass
    return Response(
        content=data,
        media_type="application/vnd.recordare.musicxml+xml",
        headers={"Content-Disposition": 'attachment; filename="score.musicxml"'},
    )


@app.post("/api/export/pdf")
def export_pdf(req: ExportRequest) -> FileResponse:
    score = _build_score(req)
    out = Path(tempfile.mkdtemp()) / "score.pdf"
    try:
        score.write("musicxml.pdf", fp=str(out))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=(
                "PDF export failed. Install MuseScore (brew install --cask musescore) "
                "or LilyPond and configure music21's environment via "
                "`python -m music21.configure`. Error: " + str(e)
            ),
        )
    if not out.exists():
        candidate = out.with_suffix(".pdf")
        if candidate.exists():
            out = candidate
    if not out.exists():
        raise HTTPException(status_code=500, detail="PDF was not produced.")
    return FileResponse(str(out), media_type="application/pdf", filename="score.pdf")


@app.get("/api/health")
def health() -> dict:
    return {"ok": True}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
