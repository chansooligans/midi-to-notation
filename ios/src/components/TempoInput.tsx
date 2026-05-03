import { View, Text, TouchableOpacity, TextInput, StyleSheet } from "react-native";
import { useState } from "react";

interface Props {
  value: number;
  onChange: (v: number) => void;
}

export function TempoInput({ value, onChange }: Props) {
  const [text, setText] = useState(String(value));

  const commit = () => {
    const n = parseInt(text, 10);
    if (n >= 20 && n <= 300) onChange(n);
    else setText(String(value));
  };

  const nudge = (d: number) => {
    const next = Math.max(20, Math.min(300, value + d));
    onChange(next);
    setText(String(next));
  };

  return (
    <View style={s.row}>
      <TouchableOpacity style={s.nudge} onPress={() => nudge(-5)}>
        <Text style={s.nudgeText}>−</Text>
      </TouchableOpacity>
      <TextInput
        style={s.input}
        keyboardType="number-pad"
        value={text}
        onChangeText={setText}
        onBlur={commit}
        onSubmitEditing={commit}
        selectTextOnFocus
      />
      <Text style={s.unit}>BPM</Text>
      <TouchableOpacity style={s.nudge} onPress={() => nudge(5)}>
        <Text style={s.nudgeText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  nudge: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: "#333",
    justifyContent: "center",
    alignItems: "center",
  },
  nudgeText: { color: "#ccc", fontSize: 18 },
  input: {
    width: 56,
    height: 36,
    backgroundColor: "#222",
    color: "#fff",
    textAlign: "center",
    borderRadius: 6,
    fontSize: 16,
    fontWeight: "600",
  },
  unit: { color: "#888", fontSize: 13 },
});
