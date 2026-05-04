import { useEffect, useRef } from "react";
import { TouchableOpacity, View, Text, StyleSheet, Animated } from "react-native";

interface Props {
  isRecording: boolean;
  label: string;
  onPress: () => void;
  color?: string;
}

export function RecordButton({ isRecording, label, onPress, color = "#e74c3c" }: Props) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.3, duration: 600, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        ]),
      ).start();
    } else {
      pulse.setValue(1);
    }
  }, [isRecording, pulse]);

  return (
    <TouchableOpacity
      style={[s.btn, isRecording && s.btnRecording]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Animated.View
        style={[
          s.dot,
          isRecording ? s.dotRecording : { backgroundColor: color },
          isRecording && { transform: [{ scale: pulse }] },
        ]}
      />
      <Text style={s.label}>{label}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 3,
    backgroundColor: "#2e2e2e",
    borderWidth: 1,
    borderColor: "#3a3a3a",
  },
  btnRecording: {
    backgroundColor: "rgba(204, 51, 51, 0.12)",
    borderColor: "rgba(204, 51, 51, 0.3)",
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  dotRecording: {
    backgroundColor: "#cc3333",
    shadowColor: "#cc3333",
    shadowRadius: 8,
    shadowOpacity: 0.9,
    shadowOffset: { width: 0, height: 0 },
  },
  label: {
    color: "#c8c8c8", fontSize: 11, fontWeight: "700",
    letterSpacing: 1, textTransform: "uppercase",
  },
});
