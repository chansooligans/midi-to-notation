import { useState, useCallback, useRef, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, Switch,
} from "react-native";
import Slider from "@react-native-community/slider";
import * as DocumentPicker from "expo-document-picker";
import { useAppState } from "../../src/hooks/useAppState";
import { RecordButton } from "../../src/components/RecordButton";
import { TempoInput } from "../../src/components/TempoInput";
import { GridPicker } from "../../src/components/GridPicker";
import { useMidiRecorder } from "../../src/midi/useMidiRecorder";
import { CoreMidi } from "../../src/midi/CoreMidiModule";
import { useAudioRecorder } from "../../src/audio/useAudioRecorder";
import { convertAudioFile, quantize, healthCheck } from "../../src/api/client";
import { MidiDevice } from "../../src/midi/types";

export default function RecordScreen() {
  const {
    phase, settings, setPhase, updateSettings, setRawEvents,
    setQuantizedNotes, setError, setBusy, error, busy,
  } = useAppState();

  const [devices, setDevices] = useState<MidiDevice[]>([]);
  const [connected, setConnected] = useState(false);
  const [backendOk, setBackendOk] = useState<boolean | null>(null);

  const midi = useMidiRecorder(settings.debounceMs);
  const audio = useAudioRecorder();

  useEffect(() => {
    healthCheck().then(setBackendOk);
  }, [settings.backendUrl]);

  const refreshDevices = useCallback(async () => {
    const list = await CoreMidi.listDevices();
    setDevices(list);
  }, []);

  const connectBle = useCallback(async () => {
    await CoreMidi.showBluetoothPicker();
    refreshDevices();
  }, [refreshDevices]);

  // --- MIDI recording ---
  const startMidi = useCallback(() => {
    CoreMidi.setCallback((type, note, velocity) => {
      if (type === "note_on" && velocity > 0) midi.handleNoteOn(note, velocity);
      else midi.handleNoteOff(note);
    });
    midi.start();
    setPhase("recording-midi");
    setError(null);
  }, [midi, setPhase, setError]);

  const stopMidi = useCallback(async () => {
    CoreMidi.setCallback(null);
    const events = midi.stop();
    setRawEvents(events);
    setPhase("stopped");

    if (events.length === 0) {
      setError("No notes recorded");
      return;
    }

    setBusy(true);
    try {
      const res = await quantize(events, settings.tempo, settings.gridKey);
      setQuantizedNotes(res.quantized);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }, [midi, settings, setPhase, setRawEvents, setQuantizedNotes, setError, setBusy]);

  // --- Audio recording ---
  const startAudio = useCallback(async () => {
    try {
      await audio.start();
      setPhase("recording-audio");
      setError(null);
    } catch (e: any) {
      setError(`Mic error: ${e.message}`);
    }
  }, [audio, setPhase, setError]);

  const stopAudio = useCallback(async () => {
    setBusy(true);
    try {
      const uri = await audio.stop();
      if (!uri) throw new Error("No audio recorded");
      setPhase("stopped");

      const res = await convertAudioFile(uri, "recording.wav", settings.tempo, settings.gridKey);
      setQuantizedNotes(res.quantized);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }, [audio, settings, setPhase, setQuantizedNotes, setError, setBusy]);

  // --- File upload ---
  const pickAudioFile = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["audio/*"],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;

      const file = result.assets[0];
      setBusy(true);
      setError(null);
      const res = await convertAudioFile(
        file.uri, file.name, settings.tempo, settings.gridKey,
      );
      setQuantizedNotes(res.quantized);
      setPhase("stopped");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }, [settings, setQuantizedNotes, setPhase, setError, setBusy]);

  const isRecording = phase === "recording-midi" || phase === "recording-audio";

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Backend status */}
      {backendOk === false && (
        <View style={s.banner}>
          <Text style={s.bannerText}>Backend offline — check Settings</Text>
        </View>
      )}

      {/* MIDI Devices */}
      <Section title="MIDI Device">
        <TouchableOpacity style={s.smallBtn} onPress={connectBle}>
          <Text style={s.smallBtnText}>Connect Bluetooth MIDI</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.smallBtn} onPress={refreshDevices}>
          <Text style={s.smallBtnText}>Refresh Devices</Text>
        </TouchableOpacity>
        {devices.length === 0 && (
          <Text style={s.hint}>No devices connected</Text>
        )}
        {devices.map((d) => (
          <Text key={d.id} style={s.deviceName}>{d.name}</Text>
        ))}
      </Section>

      {/* Tempo & Grid */}
      <Section title="Tempo & Grid">
        <TempoInput value={settings.tempo} onChange={(v) => updateSettings({ tempo: v })} />
        <View style={{ height: 12 }} />
        <GridPicker
          selected={settings.gridKey}
          onSelect={(k, snap) => updateSettings({ gridKey: k, gridSnap: snap })}
        />
      </Section>

      {/* Sensitivity */}
      <Section title={`Sensitivity: ${settings.debounceMs}ms`}>
        <Slider
          style={{ width: "100%", height: 40 }}
          minimumValue={0}
          maximumValue={200}
          step={5}
          value={settings.debounceMs}
          onValueChange={(v: number) => updateSettings({ debounceMs: v })}
          minimumTrackTintColor="#4a9eff"
          maximumTrackTintColor="#444"
          thumbTintColor="#4a9eff"
        />
      </Section>

      {/* Metronome */}
      <Section title="Metronome">
        <View style={s.row}>
          <Switch
            value={settings.metronomeOn}
            onValueChange={(v) => updateSettings({ metronomeOn: v })}
            trackColor={{ true: "#4a9eff", false: "#444" }}
          />
          <Text style={s.label}>Metronome</Text>
        </View>
        {settings.metronomeOn && (
          <Slider
            style={{ width: "100%", height: 40 }}
            minimumValue={0}
            maximumValue={1}
            step={0.05}
            value={settings.metronomeVol}
            onValueChange={(v: number) => updateSettings({ metronomeVol: v })}
            minimumTrackTintColor="#4a9eff"
            maximumTrackTintColor="#444"
            thumbTintColor="#4a9eff"
          />
        )}
      </Section>

      {/* Record Buttons */}
      <Section title="Record">
        <View style={{ gap: 12 }}>
          {phase === "recording-midi" ? (
            <RecordButton isRecording label="Stop MIDI" onPress={stopMidi} />
          ) : phase === "recording-audio" ? (
            <RecordButton isRecording label="Stop Audio" onPress={stopAudio} />
          ) : (
            <>
              <RecordButton isRecording={false} label="Record MIDI" onPress={startMidi} color="#4a9eff" />
              <RecordButton isRecording={false} label="Record Audio" onPress={startAudio} color="#e67e22" />
              <TouchableOpacity style={s.uploadBtn} onPress={pickAudioFile}>
                <Text style={s.uploadBtnText}>Upload Audio File</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </Section>

      {/* Status */}
      {busy && <Text style={s.status}>Processing...</Text>}
      {error && <Text style={s.errorText}>{error}</Text>}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1a1a2e" },
  content: { padding: 16 },
  section: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: "#222240",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#333",
  },
  sectionTitle: { color: "#aaa", fontSize: 13, fontWeight: "600", marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  label: { color: "#ccc", fontSize: 14 },
  hint: { color: "#666", fontSize: 13, marginTop: 8 },
  deviceName: { color: "#4a9eff", fontSize: 14, marginTop: 4 },
  smallBtn: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8,
    backgroundColor: "#333", marginBottom: 8,
  },
  smallBtnText: { color: "#ccc", fontSize: 14 },
  uploadBtn: {
    paddingHorizontal: 20, paddingVertical: 14, borderRadius: 10,
    backgroundColor: "#2a2a40", borderWidth: 1, borderColor: "#444",
    alignItems: "center",
  },
  uploadBtnText: { color: "#ccc", fontSize: 16 },
  banner: {
    padding: 10, backgroundColor: "#e74c3c33", borderRadius: 8,
    marginBottom: 16, borderWidth: 1, borderColor: "#e74c3c55",
  },
  bannerText: { color: "#e74c3c", fontSize: 13, textAlign: "center" },
  status: { color: "#4a9eff", textAlign: "center", marginTop: 16, fontSize: 14 },
  errorText: { color: "#e74c3c", textAlign: "center", marginTop: 8, fontSize: 13 },
});
