import React, { useState } from "react";
import { Text, Alert, Switch } from "react-native";
import { Screen, Card, Button, Field, Row, styles } from "../components/ui";
import LearningCard from "../components/LearningCard";
import { useApp } from "../state/AppContext";
import { deleteFeedback } from "../domain/preparation.mjs";
export default function Privacy() {
  const app = useApp(),
    t = app.session.travel;
  const [minutes, setMinutes] = useState(String(t.home.prep)),
    [buffer, setBuffer] = useState(String(t.home.buffer));
  return (
    <Screen>
      <Card>
        <Text style={styles.heading}>Your usual preparation time</Text>
        <Field
          label="Minutes to get ready"
          value={minutes}
          keyboardType="number-pad"
          onChangeText={setMinutes}
        />
        <Field
          label="Arrive early by (minutes)"
          value={buffer}
          keyboardType="number-pad"
          onChangeText={setBuffer}
        />
        <Button
          title="Save my choice"
          onPress={() => {
            const p = Number(minutes),
              b = Number(buffer);
            if (
              !Number.isInteger(p) ||
              p < 1 ||
              p > 240 ||
              !Number.isInteger(b) ||
              b < 1 ||
              b > 30
            ) {
              app.setNotice("Preparation: 1–240 whole minutes. Buffer: 1–30.");
              return;
            }
            app.update((s) => {
              s.travel.home.prep = p;
              s.travel.home.buffer = b;
            });
            app.setNotice(
              "Saved for future trips. Your current trip and imported iPhone alarms stay unchanged.",
            );
          }}
        />
      </Card>
      <LearningCard />
      <Card>
        <Text style={styles.heading}>Recorded timings</Text>
        {t.samples.length ? (
          t.samples.map((sample) => (
            <Row
              key={sample.id}
              title={`${Math.round(sample.duration)} min`}
              subtitle={
                app.demo
                  ? "Simulated record"
                  : new Date(sample.startedAt).toLocaleDateString("en-AU")
              }
            >
              <Switch
                accessibilityLabel={`Use ${Math.round(sample.duration)} minute timing`}
                value={!sample.excluded}
                onValueChange={(value) =>
                  app.update((s) => {
                    s.travel.samples.find((v) => v.id === sample.id).excluded =
                      !value;
                  })
                }
              />
            </Row>
          ))
        ) : (
          <Text style={styles.muted}>No measured timings yet.</Text>
        )}
        <Text style={styles.muted}>
          The estimate uses only Start / Ready measurements. From 3 samples it
          learns a personal average; from 8 it also considers time and
          weekday/weekend. Accuracy has not been validated.
        </Text>
        <Button
          secondary
          disabled={!t.samples.length}
          title="Delete preparation records"
          onPress={() =>
            Alert.alert(
              "Delete timings?",
              "This removes the records used for personal estimates. Your settings and collection stay.",
              [
                { text: "Keep", style: "cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: () =>
                    app.update((s) => {
                      s.travel.samples = [];
                    }),
                },
              ],
            )
          }
        />
        <Button
          secondary
          disabled={!t.reflections.length}
          title="Delete feedback"
          onPress={() =>
            Alert.alert(
              "Delete feedback?",
              "Measured timings, settings and collection stay unchanged.",
              [
                { text: "Keep", style: "cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: () => app.update((s) => deleteFeedback(s.travel)),
                },
              ],
            )
          }
        />
      </Card>
      <Card>
        <Text style={styles.muted}>
          Records and recordings stay on this device. They are not sent to an AI
          service or included in transport searches. Expo Go has separate
          storage from Safari. Uninstalling Expo Go can remove its stored data.
        </Text>
      </Card>
    </Screen>
  );
}
