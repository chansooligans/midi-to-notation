import { useState, useCallback, useEffect } from "react";
import {
  View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Alert,
} from "react-native";
import { useAppState } from "../../src/hooks/useAppState";
import { healthCheck, setBaseUrl, getBaseUrl } from "../../src/api/client";

export default function SettingsScreen() {
  const { settings, updateSettings, reset } = useAppState();
  const [urlInput, setUrlInput] = useState(settings.backendUrl);
  const [status, setStatus] = useState<"idle" | "ok" | "fail">("idle");

  const testConnection = useCallback(async () => {
    setBaseUrl(urlInput);
    updateSettings({ backendUrl: urlInput });
    const ok = await healthCheck();
    setStatus(ok ? "ok" : "fail");
  }, [urlInput, updateSettings]);

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      <Section title="Backend Connection">
        <Text style={s.label}>Server URL</Text>
        <TextInput
          style={s.input}
          value={urlInput}
          onChangeText={setUrlInput}
          placeholder="http://192.168.1.x:8000"
          placeholderTextColor="#555"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />
        <View style={s.row}>
          <TouchableOpacity style={s.btn} onPress={testConnection}>
            <Text style={s.btnText}>Test Connection</Text>
          </TouchableOpacity>
          {status === "ok" && <Text style={s.ok}>Connected</Text>}
          {status === "fail" && <Text style={s.fail}>Failed</Text>}
        </View>
        <Text style={s.hint}>
          The Python backend must be running and accessible from this device.
          Use your computer's local IP (not localhost) when testing on a real device.
        </Text>
      </Section>

      <Section title="Defaults">
        <Text style={s.label}>Default Transposition</Text>
        <TextInput
          style={s.input}
          value={settings.transposition}
          onChangeText={(v) => updateSettings({ transposition: v })}
          placeholderTextColor="#555"
        />

        <Text style={[s.label, { marginTop: 12 }]}>Default Time Signature</Text>
        <View style={s.row}>
          {["4/4", "3/4", "6/8", "2/4"].map((ts) => (
            <TouchableOpacity
              key={ts}
              style={[s.chip, settings.timeSig === ts && s.chipActive]}
              onPress={() => updateSettings({ timeSig: ts })}
            >
              <Text style={[s.chipText, settings.timeSig === ts && s.chipActiveText]}>{ts}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Section>

      <Section title="Data">
        <TouchableOpacity
          style={[s.btn, { backgroundColor: "#e74c3c33" }]}
          onPress={() => {
            Alert.alert("Reset", "Clear all recorded data?", [
              { text: "Cancel", style: "cancel" },
              { text: "Reset", style: "destructive", onPress: reset },
            ]);
          }}
        >
          <Text style={[s.btnText, { color: "#e74c3c" }]}>Reset All Data</Text>
        </TouchableOpacity>
      </Section>

      <View style={s.about}>
        <Text style={s.aboutText}>MIDI to Notation v1.0.0</Text>
        <Text style={s.aboutSub}>Built for Yamaha YDS-150</Text>
      </View>
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
    marginBottom: 20, padding: 16, backgroundColor: "#222240",
    borderRadius: 12, borderWidth: 1, borderColor: "#333",
  },
  sectionTitle: {
    color: "#aaa", fontSize: 13, fontWeight: "600", marginBottom: 12,
    textTransform: "uppercase", letterSpacing: 1,
  },
  label: { color: "#888", fontSize: 13, marginBottom: 6 },
  input: {
    backgroundColor: "#1a1a2e", color: "#fff", borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 15,
    borderWidth: 1, borderColor: "#444",
  },
  row: { flexDirection: "row", gap: 8, marginTop: 10, alignItems: "center", flexWrap: "wrap" },
  btn: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8,
    backgroundColor: "#333", borderWidth: 1, borderColor: "#444",
  },
  btnText: { color: "#ccc", fontSize: 14 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6,
    backgroundColor: "#2a2a40", borderWidth: 1, borderColor: "#444",
  },
  chipActive: { backgroundColor: "#4a9eff", borderColor: "#4a9eff" },
  chipText: { color: "#ccc", fontSize: 13 },
  chipActiveText: { color: "#fff", fontWeight: "600" },
  ok: { color: "#2ecc71", fontSize: 14, fontWeight: "600" },
  fail: { color: "#e74c3c", fontSize: 14, fontWeight: "600" },
  hint: { color: "#555", fontSize: 12, marginTop: 10, lineHeight: 18 },
  about: { alignItems: "center", paddingVertical: 30 },
  aboutText: { color: "#555", fontSize: 14 },
  aboutSub: { color: "#444", fontSize: 12, marginTop: 4 },
});
