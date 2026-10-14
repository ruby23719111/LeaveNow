import React from "react";
import { Text } from "react-native";
import { router } from "expo-router";
import { Screen, Card, Button, Chips, styles } from "../components/ui";
import Buddy from "../components/Buddy";
import { useApp } from "../state/AppContext";
import { FEEDBACK, feedbackChoice } from "../domain/preparation.mjs";
import { reportOutcome } from "../state/session.mjs";
export default function Feedback() {
  const app = useApp(),
    j = app.session.travel.journey;
  if (!j)
    return (
      <Screen>
        <Button title="Back home" onPress={() => router.replace("/")} />
      </Screen>
    );
  const draft = j.feedbackDraft;
  const finish = (outcome, details = {}) => {
    app.update((s) => reportOutcome(s, outcome, details));
    void app.say(
      outcome === "caught"
        ? "caught"
        : details.category === "transport"
          ? "caring"
          : feedbackChoice(details.category, details.reasonDetails).reason ||
            "caring",
    );
    router.replace("/result");
  };
  if (j.companionOutcome)
    return (
      <Screen>
        <Button
          title="View your result"
          onPress={() => router.replace("/result")}
        />
      </Screen>
    );
  return (
    <Screen>
      <Buddy
        emotion={draft ? "caring" : "calm"}
        text={
          draft
            ? "Ah, that’s frustrating. What got in the way?"
            : "How did your trip go?"
        }
      />
      <Card>
        {!draft ? (
          <>
            <Text style={styles.heading}>Did you catch it?</Text>
            <Text style={styles.muted}>
              You tell us — we don’t automatically track whether you boarded.
            </Text>
            <Button title="I caught it!" onPress={() => finish("caught")} />
            <Button
              secondary
              title="I missed it"
              onPress={() => {
                app.update((s) => {
                  s.travel.journey.feedbackDraft = {
                    category: "",
                    reasonDetails: [],
                  };
                });
                void app.say("missed");
              }}
            />
          </>
        ) : !draft.category ? (
          <>
            <Text style={styles.heading}>What got in the way?</Text>
            {Object.entries(FEEDBACK).map(([id, item]) => (
              <Button
                secondary
                key={id}
                title={item.label}
                onPress={() =>
                  id === "other"
                    ? finish("missed", { category: "other" })
                    : app.update((s) => {
                        s.travel.journey.feedbackDraft = {
                          category: id,
                          reasonDetails: [],
                        };
                      })
                }
              />
            ))}
          </>
        ) : (
          <>
            <Text style={styles.heading}>{FEEDBACK[draft.category].label}</Text>
            <Text style={styles.muted}>
              Pick any details, or skip. This is your experience, not a
              confirmed cause.
            </Text>
            <Chips
              options={FEEDBACK[draft.category].details}
              selected={draft.reasonDetails}
              onToggle={(id) =>
                app.update((s) => {
                  const d = s.travel.journey.feedbackDraft;
                  d.reasonDetails = d.reasonDetails.includes(id)
                    ? d.reasonDetails.filter((v) => v !== id)
                    : [...d.reasonDetails, id];
                })
              }
            />
            <Button
              title="Save feedback"
              onPress={() => finish("missed", draft)}
            />
            <Button
              secondary
              title="Save without details"
              onPress={() => finish("missed", { category: draft.category })}
            />
            <Button
              quiet
              title="Back to reasons"
              onPress={() =>
                app.update((s) => {
                  s.travel.journey.feedbackDraft = {
                    category: "",
                    reasonDetails: [],
                  };
                })
              }
            />
          </>
        )}
        {draft && (
          <Button
            quiet
            title="Skip feedback"
            onPress={() => finish("missed")}
          />
        )}
      </Card>
    </Screen>
  );
}
