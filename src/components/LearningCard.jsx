import React, { useState } from "react";
import { Text } from "react-native";
import { Card, Button, Field, styles } from "./ui";
import { useApp } from "../state/AppContext";
import { estimatePreparation, validSamples } from "../domain/learning.mjs";
import { suggestionKey } from "../domain/companion.mjs";
export default function LearningCard() {
  const app = useApp(),
    t = app.session.travel,
    m = estimatePreparation(t.samples, t.home.prep);
  const [editing, setEditing] = useState(false),
    [minutes, setMinutes] = useState(String(m.minutes));
  const key = suggestionKey(
    validSamples(t.samples),
    m.minutes,
    t.home.prep,
    m.mode,
  );
  function choose(value) {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 1 || n > 240) {
      app.setNotice("Choose 1 to 240 whole minutes.");
      return;
    }
    app.update((s) => {
      s.travel.home.prep = n;
      const next = estimatePreparation(s.travel.samples, n);
      s.buddy.dismissedSuggestion = suggestionKey(
        validSamples(s.travel.samples),
        next.minutes,
        n,
        next.mode,
      );
    });
    setEditing(false);
    void app.say("updated");
  }
  return (
    <Card>
      <Text style={styles.eyebrow}>
        {app.demo ? "SIMULATED LEARNING EXAMPLE" : "YOUR PREPARATION ESTIMATE"}
      </Text>
      {m.mode === "insufficient" ? (
        <Text style={styles.muted}>
          {m.sampleCount} valid timings. At least 3 recorded start-to-ready
          timings are needed before making a suggestion.
        </Text>
      ) : (
        <>
          <Text style={styles.heading}>{m.minutes} minutes to get ready</Text>
          <Text style={styles.muted}>
            Based on {m.sampleCount} {app.demo ? "simulated" : "recorded"}{" "}
            timings
            {m.mode === "contextual"
              ? ", considering time of day and weekday/weekend"
              : ""}
            . Your usual setting is {t.home.prep} minutes.
          </Text>
          {app.session.buddy.dismissedSuggestion !== key && (
            <>
              {editing ? (
                <>
                  <Field
                    label="Your choice (minutes)"
                    keyboardType="number-pad"
                    value={minutes}
                    onChangeText={setMinutes}
                  />
                  <Button
                    title="Save my choice"
                    onPress={() => choose(minutes)}
                  />
                </>
              ) : (
                <>
                  <Button
                    title={`Use ${m.minutes} minutes`}
                    onPress={() => choose(m.minutes)}
                  />
                  <Button
                    secondary
                    title="Adjust suggestion"
                    onPress={() => setEditing(true)}
                  />
                </>
              )}
              <Button
                quiet
                title="Keep my usual time"
                onPress={() => {
                  app.update((s) => {
                    s.buddy.dismissedSuggestion = key;
                  });
                  void app.say("kept");
                }}
              />
            </>
          )}
        </>
      )}
      <Text style={styles.muted}>
        Only measured preparation time is used. Activity selections and missed
        services never automatically increase your time. Changes apply to future
        trips.
      </Text>
    </Card>
  );
}
