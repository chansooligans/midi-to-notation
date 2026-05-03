import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { GRID_OPTIONS } from "../api/types";

interface Props {
  selected: string;
  onSelect: (gridKey: string, snapSize: number) => void;
}

export function GridPicker({ selected, onSelect }: Props) {
  return (
    <View style={s.row}>
      {GRID_OPTIONS.map((opt) => (
        <TouchableOpacity
          key={opt.value}
          style={[s.btn, selected === opt.value && s.active]}
          onPress={() => onSelect(opt.value, opt.snapSize)}
        >
          <Text style={[s.label, selected === opt.value && s.activeLabel]}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", gap: 8 },
  btn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: "#2a2a40",
    borderWidth: 1,
    borderColor: "#444",
  },
  active: { backgroundColor: "#4a9eff", borderColor: "#4a9eff" },
  label: { color: "#ccc", fontSize: 13 },
  activeLabel: { color: "#fff", fontWeight: "600" },
});
