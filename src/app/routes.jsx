import React from "react";
import { Text, Linking } from "react-native";
import { router } from "expo-router";
import { Screen, Card, Button, styles } from "../components/ui";
import { useApp } from "../state/AppContext";
import {
  makeJourney,
  journeyTiming,
  profileName,
  acceptPlan,
} from "../domain/address-planner.mjs";
import { displayTime } from "../domain/live-planner.mjs";
import { officialUrl } from "../services/api";
export const routeLabel = (s) =>
  (s.legs || [])
    .filter((l) => l.mode !== "Walk")
    .map((l) => `${l.mode} ${l.route || l.routeName || ""}`)
    .join(" → ") || "Walking";
export default function Routes() {
  const app = useApp(),
    r = app.routes;
  if (!r)
    return (
      <Screen>
        <Button title="Back home" onPress={() => router.replace("/")} />
      </Screen>
    );
  const entries = r.data.services
    .map((service) => {
      const j = r.replan
        ? { ...app.session.travel.journey, service, committed: {} }
        : makeJourney(r.settings, service, []);
      return { service, t: journeyTiming(j) };
    })
    .filter((x) => x.t.feasible)
    .sort(
      (a, b) =>
        Number(a.t.late > 0) - Number(b.t.late > 0) ||
        a.t.arrival - b.t.arrival,
    )
    .slice(0, 6);
  function choose(service) {
    try {
      const journey = r.replan
        ? structuredClone(app.session.travel.journey)
        : makeJourney(r.settings, service, r.data.services);
      if (r.replan) acceptPlan(journey, service);
      if (!journeyTiming(journey).feasible)
        throw Error("This journey no longer fits. Please search again.");
      Object.assign(journey, {
        profileId: r.profileId,
        destinationName: profileName(app.session.travel, r.profileId),
        armed: true,
        cues: [],
        feed: r.data.feed,
        officialUrl: r.data.officialUrl,
        preparation: r.choice || journey.preparation,
        searchQuery: r.query || {},
      });
      app.update((s) => {
        s.travel.journey = journey;
        s.travel.preparationDraft = null;
      });
      void app.say("armed");
      router.replace("/trip");
    } catch (e) {
      app.setNotice(e.message);
    }
  }
  return (
    <Screen>
      <Text style={styles.title}>Choose your trip.</Text>
      <Card>
        <Text style={styles.muted}>
          Translink journey-planner times. Live arrival predictions are not
          confirmed. Includes a {r.settings.buffer}-minute buffer.
        </Text>
        {r.replan && (
          <Text style={styles.muted}>
            Changing this plan does not update imported iPhone alarms.
          </Text>
        )}
      </Card>
      {entries.length ? (
        entries.map(({ service, t }) => (
          <Card key={service.id}>
            <Text style={styles.heading}>
              {displayTime(t.leave)} → {displayTime(t.arrival)}
            </Text>
            <Text style={styles.muted}>Leave Home · Arrive at destination</Text>
            <Text style={styles.text}>{routeLabel(service)}</Text>
            <Text style={styles.muted}>
              {Math.round(service.walk)} min walk to board ·{" "}
              {service.transfers || 0} changes
            </Text>
            <Text style={styles.text}>
              Start getting ready at {displayTime(t.start)}
            </Text>
            {t.late > 0 && (
              <Text style={{ color: "#AC282D" }}>
                Arrives {Math.ceil(t.late)} min after your target
              </Text>
            )}
            <Button title="Choose this trip" onPress={() => choose(service)} />
          </Card>
        ))
      ) : (
        <Card>
          <Text style={styles.text}>
            No returned journey fits your preparation time. Try a later arrival
            time.
          </Text>
        </Card>
      )}
      <Button
        secondary
        title="More options on Translink ↗"
        onPress={() => Linking.openURL(officialUrl)}
      />
    </Screen>
  );
}
