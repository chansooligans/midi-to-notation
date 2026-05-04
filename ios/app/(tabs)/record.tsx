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
          minimumTrackTintColor="#5aac6e"
          maximumTrackTintColor="#444"
          thumbTintColor="#5aac6e"
        />
      </Section>

      {/* Metronome */}
      <Section title="Metronome">
        <View style={s.row}>
          <Switch
            value={settings.metronomeOn}
            onValueChange={(v) => updateSettings({ metronomeOn: v })}
            trackColor={{ true: "#5aac6e", false: "#3a3a3a" }}
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
            minimumTrackTintColor="#5aac6e"
            maximumTrackTintColor="#444"
            thumbTintColor="#5aac6e"
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
              <RecordButton isRecording={false} label="REC MIDI" onPress={startMidi} color="#5aac6e" />
              <RecordButton isRecording={false} label="REC AUDIO" onPress={startAudio} color="#d4943a" />
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
  container: { flex: 1, backgroundColor: "#1a1a1a" },
  content: { padding: 12 },
  section: {
    marginBottom: 12,
    padding: 14,
    backgroundColor: "#242424",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#3a3a3a",
  },
  sectionTitle: {
    color: "#808080", fontSize: 9, fontWeight: "700", marginBottom: 10,
    textTransform: "uppercase", letterSpacing: 1.5,
    borderBottomWidth: 1, borderBottomColor: "#3a3a3a", paddingBottom: 6,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  label: { color: "#aaa", fontSize: 12 },
  hint: { color: "#585858", fontSize: 11, marginTop: 8, fontFamily: "Menlo" },
  deviceName: { color: "#5aac6e", fontSize: 12, marginTop: 4, fontFamily: "Menlo" },
  smallBtn: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 3,
    backgroundColor: "#2e2e2e", marginBottom: 6,
    borderWidth: 1, borderColor: "#3a3a3a",
  },
  smallBtnText: { color: "#aaa", fontSize: 11, fontWeight: "600", letterSpacing: 0.5 },
  uploadBtn: {
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 3,
    backgroundColor: "#2e2e2e", borderWidth: 1, borderColor: "#3a3a3a",
    alignItems: "center",
  },
  uploadBtnText: { color: "#aaa", fontSize: 11, fontWeight: "600", letterSpacing: 0.5, textTransform: "uppercase" },
  banner: {
    padding: 8, backgroundColor: "rgba(204,51,51,0.1)", borderRadius: 3,
    marginBottom: 12, borderWidth: 1, borderColor: "rgba(204,51,51,0.25)",
  },
  bannerText: { color: "#cc3333", fontSize: 11, textAlign: "center", fontFamily: "Menlo" },
  status: { color: "#5aac6e", textAlign: "center", marginTop: 12, fontSize: 11, fontFamily: "Menlo" },
  errorText: { color: "#cc3333", textAlign: "center", marginTop: 8, fontSize: 11, fontFamily: "Menlo" },
});
