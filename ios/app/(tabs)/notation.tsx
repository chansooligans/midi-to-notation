import { useCallback, useEffect, useState } from "react";
import {
  View, Text, TouchableOpacity, TextInput, ScrollView, StyleSheet, Alert,
} from "react-native";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { useAppState } from "../../src/hooks/useAppState";
import { NotationWebView } from "../../src/notation/NotationWebView";
import { exportMusicXML, exportPdfBlob, getTranspositions } from "../../src/api/client";
import { GridPicker } from "../../src/components/GridPicker";

export default function NotationScreen() {
  const { quantizedNotes, settings, updateSettings, musicXml, setMusicXml, setBusy, setError, busy, error } = useAppState();
  const [transpositions, setTranspositions] = useState<string[]>([]);

  useEffect(() => {
    getTranspositions()
      .then((r) => setTranspositions(r.options))
      .catch(() => {});
  }, []);

  const renderScore = useCallback(async () => {
    if (quantizedNotes.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const xml = await exportMusicXML({
        transposition: settings.transposition,
        time_sig: settings.timeSig,
        title: settings.title,
        tempo_bpm: settings.tempo,
        notes: quantizedNotes,
      });
      setMusicXml(xml);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }, [quantizedNotes, settings, setBusy, setError, setMusicXml]);

  const sharePdf = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const buf = await exportPdfBlob({
        transposition: settings.transposition,
        time_sig: settings.timeSig,
        title: settings.title,
        tempo_bpm: settings.tempo,
        notes: quantizedNotes,
      });

      const path = FileSystem.cacheDirectory + "score.pdf";
      await FileSystem.writeAsStringAsync(
        path,
        arrayBufferToBase64(buf),
        { encoding: FileSystem.EncodingType.Base64 },
      );
      await Sharing.shareAsync(path, { mimeType: "application/pdf" });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }, [quantizedNotes, settings, setBusy, setError]);

  const shareXml = useCallback(async () => {
    if (!musicXml) return;
    const path = FileSystem.cacheDirectory + "score.musicxml";
    await FileSystem.writeAsStringAsync(path, musicXml);
    await Sharing.shareAsync(path, {
      mimeType: "application/vnd.recordare.musicxml+xml",
    });
  }, [musicXml]);

  if (quantizedNotes.length === 0) {
    return (
      <View style={s.empty}>
        <Text style={s.emptyIcon}>🎼</Text>
        <Text style={s.emptyText}>No notation to display</Text>
        <Text style={s.emptyHint}>Record or import music first</Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      {/* Controls */}
      <ScrollView horizontal style={s.controls} contentContainerStyle={s.controlsContent}>
        <View style={s.field}>
          <Text style={s.fieldLabel}>Title</Text>
          <TextInput
            style={s.textInput}
            value={settings.title}
            onChangeText={(v) => updateSettings({ title: v })}
            placeholderTextColor="#666"
          />
        </View>

        <View style={s.field}>
          <Text style={s.fieldLabel}>Time Sig</Text>
          <View style={s.row}>
            {["4/4", "3/4", "6/8", "2/4"].map((ts) => (
              <TouchableOpacity
                key={ts}
                style={[s.chip, settings.timeSig === ts && s.chipActive]}
                onPress={() => updateSettings({ timeSig: ts })}
              >
                <Text style={[s.chipText, settings.timeSig === ts && s.chipTextActive]}>{ts}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={s.field}>
          <Text style={s.fieldLabel}>Transposition</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={s.row}>
              {transpositions.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[s.chip, settings.transposition === t && s.chipActive]}
                  onPress={() => updateSettings({ transposition: t })}
                >
                  <Text style={[s.chipText, settings.transposition === t && s.chipTextActive]}>
                    {t.replace(/_/g, " ")}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      </ScrollView>

      {/* Action buttons */}
      <View style={s.actions}>
        <TouchableOpacity style={s.renderBtn} onPress={renderScore} disabled={busy}>
          <Text style={s.renderBtnText}>{busy ? "Rendering..." : "Render Score"}</Text>
        </TouchableOpacity>
        {musicXml && (
          <>
            <TouchableOpacity style={s.exportBtn} onPress={sharePdf}>
              <Text style={s.exportBtnText}>Share PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.exportBtn} onPress={shareXml}>
              <Text style={s.exportBtnText}>Share MusicXML</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {error && <Text style={s.errorText}>{error}</Text>}

      {/* Notation WebView */}
      <NotationWebView musicXml={musicXml} onError={(msg) => setError(msg)} />
    </View>
  );
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#1a1a2e" },
  controls: { maxHeight: 160, borderBottomWidth: 1, borderBottomColor: "#333" },
  controlsContent: { padding: 12, gap: 12 },
  field: { marginRight: 20 },
  fieldLabel: { color: "#888", fontSize: 11, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 },
  textInput: {
    backgroundColor: "#222", color: "#fff", borderRadius: 6,
    paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, minWidth: 160,
  },
  row: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6,
    backgroundColor: "#2a2a40", borderWidth: 1, borderColor: "#444",
  },
  chipActive: { backgroundColor: "#4a9eff", borderColor: "#4a9eff" },
  chipText: { color: "#ccc", fontSize: 13 },
  chipTextActive: { color: "#fff", fontWeight: "600" },
  actions: {
    flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: "#333",
  },
  renderBtn: {
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 8,
    backgroundColor: "#4a9eff",
  },
  renderBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
  exportBtn: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8,
    backgroundColor: "#333", borderWidth: 1, borderColor: "#444",
  },
  exportBtnText: { color: "#ccc", fontSize: 14 },
  errorText: { color: "#e74c3c", textAlign: "center", padding: 8, fontSize: 13 },
  empty: { flex: 1, backgroundColor: "#1a1a2e", justifyContent: "center", alignItems: "center" },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: "#888", fontSize: 18 },
  emptyHint: { color: "#555", fontSize: 14, marginTop: 4 },
});
