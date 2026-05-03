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
    gap: 12,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: "#222240",
    borderWidth: 1,
    borderColor: "#333355",
  },
  btnRecording: {
    backgroundColor: "rgba(231, 76, 60, 0.12)",
    borderColor: "rgba(231, 76, 60, 0.3)",
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  dotRecording: {
    backgroundColor: "#e74c3c",
    shadowColor: "#e74c3c",
    shadowRadius: 10,
    shadowOpacity: 0.9,
    shadowOffset: { width: 0, height: 0 },
  },
  label: { color: "#fff", fontSize: 16, fontWeight: "600", letterSpacing: 0.3 },
});
