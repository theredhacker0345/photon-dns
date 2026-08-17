import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { MODEL_PROVIDER_PRESETS } from "@/lib/model-providers";
import type { ModelProviderId } from "@/lib/host-contracts";

export function ModelProviderPicker({ selected, onChange, colors }: { selected: ModelProviderId; onChange: (provider: ModelProviderId) => void; colors: { foreground: string; muted: string; background: string; surface: string; border: string; primary: string } }) {
  return (
    <View style={styles.wrap} accessibilityLabel="AI model provider picker">
      {MODEL_PROVIDER_PRESETS.map((provider) => {
        const active = provider.id === selected;
        return (
          <Pressable
            key={provider.id}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(provider.id)}
            style={({ pressed }) => [styles.option, { backgroundColor: active ? `${colors.primary}14` : colors.background, borderColor: active ? colors.primary : colors.border, opacity: pressed ? 0.72 : 1 }]}
          >
            <View style={styles.optionTop}><MaterialIcons name={active ? "radio-button-checked" : "radio-button-unchecked"} size={18} color={active ? colors.primary : colors.muted} /><Text style={[styles.optionLabel, { color: colors.foreground }]}>{provider.label}</Text></View>
            <Text style={[styles.optionDetail, { color: colors.muted }]}>{provider.description}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  option: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 5 },
  optionTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  optionLabel: { fontSize: 13, fontWeight: "900" },
  optionDetail: { fontSize: 11, lineHeight: 15, fontWeight: "600", paddingLeft: 26 },
});
