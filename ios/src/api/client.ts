import { ExportRequest, AudioConvertResponse, QuantizeResponse, PRNote, NoteEvent } from "./types";

let BASE_URL = "https://midi-to-notation.onrender.com";

export function setBaseUrl(url: string) {
  BASE_URL = url.replace(/\/+$/, "");
}

export function getBaseUrl() {
  return BASE_URL;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, init);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status}: ${body}`);
  }
  return res.json();
}

function post<T>(path: string, body: object): Promise<T> {
  return api(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function healthCheck(): Promise<boolean> {
  try {
    await api<{ ok: boolean }>("/api/health");
    return true;
  } catch {
    return false;
  }
}

export function getTranspositions(): Promise<{ options: string[] }> {
  return api("/api/transpositions");
}

export function quantize(
  events: NoteEvent[],
  tempo_bpm: number,
  grid: string,
): Promise<QuantizeResponse> {
  return post("/api/quantize", { events, tempo_bpm, grid });
}

export function requantize(
  grid: string,
  tempo_bpm: number,
): Promise<QuantizeResponse> {
  return post("/api/requantize", { grid, tempo_bpm });
}

export async function convertAudio(
  wavBytes: ArrayBuffer,
  tempo_bpm: number,
  grid: string,
): Promise<AudioConvertResponse> {
  const form = new FormData();
  form.append("audio", {
    uri: "",
    name: "recording.wav",
    type: "audio/wav",
    data: wavBytes,
  } as any);
  form.append("tempo_bpm", String(tempo_bpm));
  form.append("grid", grid);

  const res = await fetch(`${BASE_URL}/api/audio/convert`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.json();
}

export async function convertAudioFile(
  fileUri: string,
  fileName: string,
  tempo_bpm: number,
  grid: string,
): Promise<AudioConvertResponse> {
  const form = new FormData();
  form.append("audio", {
    uri: fileUri,
    name: fileName,
    type: "audio/wav",
  } as any);
  form.append("tempo_bpm", String(tempo_bpm));
  form.append("grid", grid);

  const res = await fetch(`${BASE_URL}/api/audio/convert`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.json();
}

export async function exportMusicXML(req: ExportRequest): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/export/musicxml`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.text();
}

export async function exportPdfBlob(req: ExportRequest): Promise<ArrayBuffer> {
  const res = await fetch(`${BASE_URL}/api/export/pdf`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.arrayBuffer();
}
