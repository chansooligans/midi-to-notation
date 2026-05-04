# MIDI → Notation

Record MIDI from a Yamaha YDS-150 (or any MIDI input), quantize against a metronome, and render/export musical notation.

**[Web App](https://midi-to-notation-1.onrender.com)** · **[API](https://midi-to-notation.onrender.com/api/health)**

## Architecture
- **Backend** — FastAPI + `music21` (quantization, notation, MusicXML/PDF export), deployed on Render
- **Frontend** — React + Vite, Web MIDI API for browser-based MIDI recording, OpenSheetMusicDisplay for rendering
- **iOS** — React Native + Expo for mobile recording and score display
- **Flow** — Record-then-convert: hit Record (with optional count-in and click), play, hit Stop. Notes are quantized to a configurable grid against the chosen tempo, rendered as notation, and exportable as MusicXML or PDF.

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
1. Open the [web app](https://midi-to-notation-1.onrender.com) (or run locally).
2. Connect your MIDI device (e.g. YDS-150 over USB). The browser will detect it via Web MIDI API.
3. Pick the MIDI input device, set tempo, time signature, and transposition (default: `bb_tenor`).
4. Click **REC MIDI**. After the count-in, play. Click **STOP** when done.
5. Notation renders inline. Edit notes in the piano roll. Download as MusicXML or PDF.
6. Alternatively, use **REC AUDIO** to record from a microphone, or **IMPORT** an audio file.

## Transposition
- `concert` — concert pitch
- `bb_soprano` / `bb_tenor` — written +2 / +14 semitones from concert
- `eb_alto` / `eb_baritone` — written +9 / +21 semitones from concert

The YDS-150 transmits concert MIDI by default; the app shifts pitches to written for the chosen instrument.

## Notes / Limitations
- Web MIDI API requires Chrome or Edge (Firefox and Safari don't support it yet).
- Quantization uses IOI-based articulation gap detection for wind instruments — tongued notes are handled intelligently.
- Single-line monophonic capture works best. Overlapping notes are clipped, not turned into chords.
- PDF export depends on MuseScore/LilyPond being installed on the backend.
- Render free tier spins down after inactivity; first request may take ~30s.
