import "../services/polyfills";
import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AppProvider } from "../state/AppContext";
export default function Layout() {
  return (
    <AppProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#0057A8" },
          headerTintColor: "white",
          headerShadowVisible: false,
          contentStyle: { backgroundColor: "#0057A8" },
          headerBackTitle: "Back",
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        {Object.entries({
          settings: "Your settings",
          voice: "Voice",
          place: "Your places",
          preparation: "Getting ready",
          routes: "Choose your trip",
          trip: "Your departure plan",
          feedback: "Your trip",
          result: "Your trip",
          crew: "Your travel crew",
          recordings: "Your reminder recordings",
          privacy: "Preparation & privacy",
        }).map(([name, title]) => (
          <Stack.Screen key={name} name={name} options={{ title }} />
        ))}
      </Stack>
    </AppProvider>
  );
}
