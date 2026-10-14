import React from "react";
import { Text } from "react-native";
import { router } from "expo-router";
import { Screen, Card, Button, styles } from "../components/ui";
import Buddy from "../components/Buddy";
import LearningCard from "../components/LearningCard";
import { useApp } from "../state/AppContext";
import { timingComparison, FEEDBACK } from "../domain/preparation.mjs";
import { BUDDIES } from "../domain/companion.mjs";
import { hasIPhoneHandoff } from "../domain/iphone-alarms.mjs";
export default function Result() {
  const app = useApp(),
    j = app.session.travel.journey,
    o = j?.companionOutcome;
  if (!o)
    return (
      <Screen>
        <Button title="Back home" onPress={() => router.replace("/")} />
      </Screen>
    );
  const comparison = timingComparison(j);
  return (
    <Screen>
      <Buddy
        emotion={o.outcome === "caught" ? "happy" : "caring"}
        text={
          o.outcome === "caught"
            ? "Good on ya — you made it!"
            : "One missed trip doesn’t undo your progress."
        }
      />
      <Card>
        <Text style={styles.heading}>
          {o.outcome === "caught" ? "You made it!" : "Thanks for checking in."}
        </Text>
        <Text style={styles.text}>
          {app.session.buddy.successDays.length} successful travel days · No
          streaks to lose
        </Text>
        {o.unlocked?.length > 0 && (
          <Text style={styles.text}>
            Unlocked:{" "}
            {o.unlocked
              .map((id) => BUDDIES.find((b) => b.id === id)?.name)
              .join(", ")}
          </Text>
        )}
        {comparison && (
          <>
            <Text style={styles.eyebrow}>
              {app.demo
                ? "SIMULATED TIMING EXAMPLE"
                : "YOUR RECORDED PREPARATION"}
            </Text>
            <Text style={styles.text}>
              Planned: {comparison.planned} min · Recorded:{" "}
              {comparison.recorded} min
            </Text>
          </>
        )}
        {o.category && (
          <Text style={styles.muted}>
            You reported: {FEEDBACK[o.category]?.label}.{" "}
            {o.category === "transport"
              ? "Transport conditions are not independently verified."
              : ""}
          </Text>
        )}
      </Card>
      {["transport", "walk"].includes(o.category) ? (
        <Card>
          <Text style={styles.text}>
            Your usual setting of {app.session.travel.home.prep} minutes stays
            unchanged.
          </Text>
          <Text style={styles.muted}>
            This feedback is separate from preparation timing.
          </Text>
        </Card>
      ) : (
        <LearningCard />
      )}
      <Button
        title="Done"
        onPress={() => {
          app.stop();
          app.update((s) => {
            s.travel.journey = null;
            s.travel.preparationDraft = null;
          });
          if (hasIPhoneHandoff(j))
            app.setNotice(
              "Trip finished. Any alarms imported into LeaveNow Alarms stay there until you dismiss or cancel them in that app.",
            );
          router.replace("/");
        }}
      />
    </Screen>
  );
}
