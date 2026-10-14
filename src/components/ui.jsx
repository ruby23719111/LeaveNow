import React from "react";
import {
  ScrollView,
  View,
  Text,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useApp } from "../state/AppContext";
export const colors = {
  blue: "#0057A8",
  yellow: "#FFC425",
  ink: "#152B40",
  muted: "#496176",
  pale: "#F1F5FA",
  line: "#D5E1EC",
};
export const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.blue },
  content: {
    padding: 20,
    gap: 16,
    paddingBottom: 28,
    width: "100%",
    maxWidth: 480,
    alignSelf: "center",
    flexGrow: 1,
  },
  card: { backgroundColor: "white", padding: 18, borderRadius: 22, gap: 12 },
  title: { color: "white", fontSize: 29, fontWeight: "700", letterSpacing: -1 },
  heading: { color: colors.ink, fontSize: 23, fontWeight: "700" },
  text: { fontSize: 15, color: colors.ink, lineHeight: 22 },
  muted: { fontSize: 13, color: colors.muted, lineHeight: 20 },
  eyebrow: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: "700",
    letterSpacing: 1.5,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    minHeight: 48,
    padding: 12,
    fontSize: 16,
    color: colors.ink,
    backgroundColor: "#F7FAFD",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  button: {
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: colors.yellow,
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
  },
  buttonText: { fontSize: 16, fontWeight: "650", color: colors.ink },
  secondary: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: colors.line,
  },
  quiet: { backgroundColor: "transparent" },
  chip: {
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 24,
    backgroundColor: colors.pale,
    minHeight: 44,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  section: {
    color: "#DCEAFF",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
  },
  time: { fontSize: 29, fontWeight: "700", color: colors.ink },
  notice: { backgroundColor: "#FFF3CE", padding: 12, borderRadius: 12 },
  link: { color: colors.blue, fontWeight: "600" },
  separator: { height: 1, backgroundColor: colors.line },
});
export function Button({
  title,
  onPress,
  secondary,
  quiet,
  disabled,
  style,
  ...rest
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondary,
        quiet && styles.quiet,
        { opacity: disabled ? 0.45 : pressed ? 0.75 : 1 },
        style,
      ]}
      {...rest}
    >
      <Text
        style={[
          styles.buttonText,
          quiet && { color: colors.blue, fontSize: 14 },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}
export function Screen({ children, home = false }) {
  const app = useApp();
  return (
    <SafeAreaView
      style={styles.page}
      edges={home ? ["top", "bottom"] : ["bottom"]}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          {app.demo && (
            <View
              style={[
                styles.notice,
                styles.row,
                { justifyContent: "space-between" },
              ]}
            >
              <Text style={styles.text}>DEMO · Nothing is saved</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  app.exitDemo();
                  router.replace("/");
                }}
              >
                <Text style={styles.link}>Exit</Text>
              </Pressable>
            </View>
          )}
          {app.notice ? (
            <Pressable onPress={() => app.setNotice("")} style={styles.notice}>
              <Text accessibilityLiveRegion="polite" style={styles.muted}>
                {app.notice} · Dismiss
              </Text>
            </Pressable>
          ) : null}
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}
export function Field({ label, value, onChangeText, ...props }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={[styles.text, { fontWeight: "600" }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        style={styles.input}
        value={String(value ?? "")}
        onChangeText={onChangeText}
        {...props}
      />
    </View>
  );
}
export function Row({ title, subtitle, onPress, disabled, children }) {
  const Container = onPress ? Pressable : View;
  return (
    <Container
      disabled={disabled}
      accessibilityRole={onPress ? "button" : undefined}
      onPress={onPress}
      style={[
        styles.row,
        { paddingVertical: 12, minHeight: 52, opacity: disabled ? 0.5 : 1 },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.text, { fontWeight: "600" }]}>{title}</Text>
        {subtitle && <Text style={styles.muted}>{subtitle}</Text>}
      </View>
      {children ||
        (onPress && (
          <Text style={{ fontSize: 24, color: colors.muted }}>›</Text>
        ))}
    </Container>
  );
}
export function Chips({ options, selected, onToggle }) {
  return (
    <View style={styles.chips}>
      {Object.entries(options).map(([id, label]) => (
        <Pressable
          key={id}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: selected.includes(id) }}
          onPress={() => onToggle(id)}
          style={[
            styles.chip,
            selected.includes(id) && {
              backgroundColor: colors.yellow,
              borderColor: "#B48500",
            },
          ]}
        >
          <Text style={styles.text}>
            {selected.includes(id) ? "✓ " : ""}
            {label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
