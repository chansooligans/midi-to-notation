import { Tabs } from "expo-router";
import { View, Text, StyleSheet } from "react-native";

function TabIcon({ symbol, label, focused }: { symbol: string; label: string; focused: boolean }) {
  return (
    <View style={ti.wrap}>
      <Text style={[ti.icon, focused && ti.iconActive]}>{symbol}</Text>
    </View>
  );
}

const ti = StyleSheet.create({
  wrap: { alignItems: "center", paddingTop: 4 },
  icon: { fontSize: 20, color: "#555577" },
  iconActive: { color: "#4a9eff" },
});

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: "#12122a",
          shadowColor: "transparent",
          elevation: 0,
        },
        headerTintColor: "#e8e8f0",
        headerTitleStyle: {
          fontWeight: "600",
          fontSize: 17,
          letterSpacing: -0.3,
        },
        tabBarStyle: {
          backgroundColor: "#12122a",
          borderTopColor: "#222244",
          borderTopWidth: 0.5,
          height: 84,
          paddingBottom: 28,
          paddingTop: 8,
        },
        tabBarActiveTintColor: "#4a9eff",
        tabBarInactiveTintColor: "#555577",
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "600",
          letterSpacing: 0.5,
        },
      }}
    >
      <Tabs.Screen
        name="record"
        options={{
          title: "Record",
          tabBarIcon: ({ focused }) => <TabIcon symbol="●" label="Record" focused={focused} />,
          headerTitle: "MIDI to Notation",
        }}
      />
      <Tabs.Screen
        name="editor"
        options={{
          title: "Editor",
          tabBarIcon: ({ focused }) => <TabIcon symbol="♫" label="Editor" focused={focused} />,
          headerTitle: "Piano Roll",
        }}
      />
      <Tabs.Screen
        name="notation"
        options={{
          title: "Score",
          tabBarIcon: ({ focused }) => <TabIcon symbol="𝄞" label="Score" focused={focused} />,
          headerTitle: "Notation",
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ focused }) => <TabIcon symbol="⚙" label="Settings" focused={focused} />,
          headerTitle: "Settings",
        }}
      />
    </Tabs>
  );
}
