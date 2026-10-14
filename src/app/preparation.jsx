import React, { useState } from "react";
import { Text } from "react-native";
import { router } from "expo-router";
import { Screen, Card, Button, Field, Chips, styles } from "../components/ui";
import { useApp } from "../state/AppContext";
import {
  ACTIVITIES,
  preparationChoice,
  journeyRequest,
} from "../domain/preparation.mjs";
import { settingsForTrip } from "../domain/address-planner.mjs";
import { api } from "../services/api";
import { demoJourney } from "../state/session.mjs";
export default function Preparation() {
  const app = useApp(),
    t = app.session.travel,
    draft = t.preparationDraft;
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function find(skip = false) {
    setError("");
    try {
      const choice = preparationChoice(
        skip ? t.home.prep : draft.minutes,
        skip ? [] : draft.activities,
      );
      if (app.demo) {
        app.update((s) => {
          s.travel.journey = demoJourney(choice.minutes, choice.activities);
          s.travel.preparationDraft = null;
        });
        await app.say("armed");
        router.replace("/trip");
        return;
      }
      setBusy(true);
      const settings = settingsForTrip(
        t,
        t.selected,
        draft.date,
        draft.arriveBy,
        choice.minutes,
      );
      const data = await api("/api/plan", journeyRequest(settings));
      app.setRoutes({ settings, data, choice, profileId: t.selected });
      router.push("/routes");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (!draft)
    return (
      <Screen>
        <Card>
          <Text style={styles.text}>
            Choose a destination and arrival time first.
          </Text>
          <Button title="Back home" onPress={() => router.replace("/")} />
        </Card>
      </Screen>
    );
  return (
    <Screen>
      <Card>
        <Text style={styles.eyebrow}>FOR THIS TRIP ONLY</Text>
        <Text style={styles.heading}>
          What do you need to do before heading out?
        </Text>
        <Text style={styles.muted}>
          Pick what applies, then allow time for the whole routine.
        </Text>
        <Chips
          options={ACTIVITIES}
          selected={draft.activities}
          onToggle={(id) =>
            app.update((s) => {
              const d = s.travel.preparationDraft;
              d.activities = d.activities.includes(id)
                ? d.activities.filter((x) => x !== id)
                : [...d.activities, id];
            })
          }
        />
        <Text style={styles.muted}>
          Optional — these prompts don’t add minutes.
        </Text>
        <Field
          label="Time to get ready (min)"
          value={draft.minutes}
          keyboardType="number-pad"
          maxLength={3}
          onChangeText={(value) =>
            app.update((s) => {
              s.travel.preparationDraft.minutes = value;
            })
          }
        />
        <Text style={styles.muted}>
          Your usual setting is {t.home.prep} minutes. It won’t change.
        </Text>
        {error ? <Text style={{ color: "#AC282D" }}>{error}</Text> : null}
        <Button
          title={
            busy
              ? "Finding routes…"
              : app.demo
                ? "See my demo plan"
                : "Find routes"
          }
          disabled={busy}
          onPress={() => find()}
        />
        <Button
          quiet
          title="Skip · use my usual time"
          disabled={busy}
          onPress={() => find(true)}
        />
      </Card>
    </Screen>
  );
}
