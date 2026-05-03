# MIDI → Notation

Record MIDI from a Yamaha YDS-150 (or any MIDI input), quantize against a metronome, and render/export musical notation.

## Architecture
- **Backend** — FastAPI + `mido` (MIDI capture) + `music21` (notation, MusicXML/PDF export)
- **Frontend** — React + Vite, OpenSheetMusicDisplay for rendering, Web Audio metronome
- **Flow** — Record-then-convert: hit Record (with optional count-in and click), play, hit Stop. Notes are quantized to a 16th-note grid against the chosen tempo, rendered as notation, and exportable as MusicXML or PDF.

## Setup

### Backend
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py   # http://127.0.0.1:8000
```

For PDF export, install MuseScore or LilyPond and configure music21:
```bash
brew install --cask musescore
python -m music21.configure
```

### Frontend
```bash
cd frontend
npm install
npm run dev   # http://localhost:5173
```

## Usage
1. Plug in the YDS-150 over USB.
2. Open the frontend, pick the MIDI input device (refresh if needed).
3. Set tempo, time signature, and transposition (default: `bb_tenor` — written for Bb tenor sax).
4. Click **Record**. After the count-in, play. Click **Stop** when done.
5. Notation renders inline. Download as MusicXML or PDF.

## Transposition
- `concert` — concert pitch
- `bb_soprano` / `bb_tenor` — written +2 / +14 semitones from concert
- `eb_alto` / `eb_baritone` — written +9 / +21 semitones from concert

The YDS-150 transmits concert MIDI by default; the app shifts pitches to written for the chosen instrument.

## Notes / Limitations
- Quantization is fixed to a 16th-note grid; complex rhythms may snap awkwardly.
- Single-line monophonic capture works best. Overlapping notes are clipped, not turned into chords.
- PDF rendering depends on MuseScore/LilyPond being installed and configured for music21.
