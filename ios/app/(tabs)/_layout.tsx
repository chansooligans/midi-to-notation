import { Tabs } from "expo-router";
import { View, Text, StyleSheet } from "react-native";

function TabIcon({ symbol, focused }: { symbol: string; focused: boolean }) {
  return (
    <View style={ti.wrap}>
      <Text style={[ti.icon, focused && ti.iconActive]}>{symbol}</Text>
    </View>
  );
}

const ti = StyleSheet.create({
  wrap: { alignItems: "center", paddingTop: 4 },
  icon: { fontSize: 18, color: "#585858" },
  iconActive: { color: "#5aac6e" },
});

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: "#2a2a2a",
          shadowColor: "transparent",
          elevation: 0,
          borderBottomWidth: 1,
          borderBottomColor: "#3a3a3a",
        },
        headerTintColor: "#c8c8c8",
        headerTitleStyle: {
          fontWeight: "700",
          fontSize: 13,
          letterSpacing: 1,
          textTransform: "uppercase",
        },
        tabBarStyle: {
          backgroundColor: "#2a2a2a",
          borderTopColor: "#3a3a3a",
          borderTopWidth: 1,
          height: 80,
          paddingBottom: 26,
          paddingTop: 6,
        },
        tabBarActiveTintColor: "#5aac6e",
        tabBarInactiveTintColor: "#585858",
        tabBarLabelStyle: {
          fontSize: 9,
          fontWeight: "700",
          letterSpacing: 1,
          textTransform: "uppercase",
        },
      }}
    >
      <Tabs.Screen
        name="record"
        options={{
          title: "Rec",
          tabBarIcon: ({ focused }) => <TabIcon symbol="●" focused={focused} />,
          headerTitle: "MIDI → Notation",
        }}
      />
      <Tabs.Screen
        name="editor"
        options={{
          title: "Edit",
          tabBarIcon: ({ focused }) => <TabIcon symbol="♫" focused={focused} />,
          headerTitle: "Piano Roll",
        }}
      />
      <Tabs.Screen
        name="notation"
        options={{
          title: "Score",
          tabBarIcon: ({ focused }) => <TabIcon symbol="𝄞" focused={focused} />,
          headerTitle: "Score",
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Setup",
          tabBarIcon: ({ focused }) => <TabIcon symbol="⚙" focused={focused} />,
          headerTitle: "Setup",
        }}
      />
    </Tabs>
  );
}
