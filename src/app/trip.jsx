import React, { useEffect, useState } from "react";
import { Text, View, Alert, Linking } from "react-native";
import { router } from "expo-router";
import { Screen, Card, Button, styles } from "../components/ui";
import Buddy from "../components/Buddy";
import { useApp } from "../state/AppContext";
import { recordReady } from "../state/session.mjs";
import { journeyTiming } from "../domain/address-planner.mjs";
import { requestMoreTime } from "../domain/home-planner.mjs";
import { displayTime } from "../domain/live-planner.mjs";
import {
  iPhoneAlarmHandoff,
  hasIPhoneHandoff,
  iPhoneHandoffChanged,
} from "../domain/iphone-alarms.mjs";
import { journeyRequest } from "../domain/preparation.mjs";
import { api } from "../services/api";
export default function Trip() {
  const app = useApp(),
    j = app.session.travel.journey;
  const [now, setNow] = useState(() => Date.now()),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  if (!j)
    return (
      <Screen>
        <Card>
          <Text style={styles.text}>No active trip.</Text>
          <Button title="Back home" onPress={() => router.replace("/")} />
        </Card>
      </Screen>
    );
  const timing = journeyTiming(j),
    remaining = Math.max(0, Math.ceil((j.committed.leave - now) / 1000));
  const title =
    remaining === 0
      ? "Time to head out."
      : j.readyAt
        ? "Ready when you are."
        : j.startedAt
          ? "One thing at a time."
          : "You’re all set.";
  async function alternatives() {
    setBusy(true);
    try {
      const query = {
        searchMode: "leaveAfter",
        searchAt: new Date(
          Date.now() + (timing.remaining + j.settings.buffer) * 60000,
        ).toISOString(),
      };
      const data = await api("/api/plan", journeyRequest(j.settings, query));
      app.setRoutes({
        settings: j.settings,
        data,
        replan: true,
        profileId: j.profileId,
        query,
      });
      router.push("/routes");
    } catch (e) {
      app.setNotice(e.message);
    } finally {
      setBusy(false);
    }
  }
  function alarms() {
    try {
      const request = iPhoneAlarmHandoff(j, j.destinationName);
      Alert.alert(
        "Confirm in LeaveNow Alarms",
        `Get ready: ${displayTime(request.ready, true)}\nLeave: ${displayTime(request.leave, true)}\n\nOpening the app does not set alarms. Confirm there. Imported times do not update automatically.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Open alarm app",
            onPress: async () => {
              try {
                await Linking.openURL(request.url);
                app.update((s) => {
                  if (s.travel.journey?.id === j.id)
                    s.travel.journey.iphoneHandoff = {
                      status: "attempted",
                      planId: request.planId,
                      ready: request.ready,
                      leave: request.leave,
                      issuedAt: request.issuedAt,
                    };
                });
              } catch {
                app.setNotice(
                  "LeaveNow Alarms is not installed or could not be opened.",
                );
              }
            },
          },
        ],
      );
    } catch (e) {
      app.setNotice(e.message);
    }
  }
  function finish() {
    app.stop();
    app.update((s) => {
      s.travel.journey = null;
      s.travel.preparationDraft = null;
    });
    router.replace("/");
  }
  return (
    <Screen>
      <Text style={styles.title}>{title}</Text>
      <Buddy
        emotion={remaining === 0 ? "remind" : "calm"}
        text={
          j.readyAt
            ? "Ready to roll. I’ll still remind you to leave."
            : "I’ll let you know when to get ready and when to head out."
        }
      />
      <Card>
        <View style={[styles.row, { justifyContent: "space-between" }]}>
          <View>
            <Text style={styles.muted}>Get ready</Text>
            <Text style={styles.time}>{displayTime(j.committed.start)}</Text>
          </View>
          <View>
            <Text style={styles.muted}>Leave Home</Text>
            <Text style={styles.time}>{displayTime(j.committed.leave)}</Text>
          </View>
        </View>
        <Text style={[styles.heading, { textAlign: "center" }]}>
          {remaining === 0
            ? "Leave now"
            : `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")} until you leave`}
        </Text>
        <Text style={styles.muted}>
          {app.demo
            ? "Simulated journey. Use the buttons to advance."
            : "Translink planner times; live predictions are not confirmed. Updates run while this app is active."}
        </Text>
        {j.feed?.status === "unavailable" && (
          <Text style={{ color: "#AC282D" }}>
            Could not confirm the latest transport information. Check Translink.
          </Text>
        )}
        {!timing.feasible && !j.departedAt && (
          <Text style={{ color: "#AC282D" }}>
            This trip may no longer fit your remaining preparation. Review
            alternatives.
          </Text>
        )}
        {!j.startedAt ? (
          <Button
            title="I’m starting to get ready"
            onPress={() => {
              app.update((s) => {
                s.travel.journey.startedAt = Date.now();
              });
              void app.say("prepare_any");
            }}
          />
        ) : !j.readyAt ? (
          <Button
            title="I’m ready"
            onPress={() => {
              app.update((s) => {
                if (app.demo)
                  s.travel.journey.startedAt = Date.now() - 36 * 60000;
                recordReady(s);
                if (app.demo) {
                  s.travel.journey.committed.leave = Date.now();
                  s.travel.journey.committed.start =
                    Date.now() - s.travel.journey.settings.prep * 60000;
                }
              });
              if (app.demo) void app.say("leave");
              else app.stop();
            }}
          />
        ) : null}
        <Button
          secondary
          title="I need 5 more minutes"
          onPress={() => {
            app.update((s) => requestMoreTime(s.travel.journey));
            app.setNotice(
              "Five minutes from now. Review another journey if the leave time no longer fits.",
            );
          }}
        />
        <Button
          title="I’ve left Home"
          onPress={() => {
            app.stop();
            app.update((s) => {
              s.travel.journey.departedAt = Date.now();
              s.travel.journey.armed = false;
            });
            router.replace("/feedback");
          }}
        />
        {!app.demo && (
          <Button
            secondary
            title={busy ? "Checking…" : "Find another journey"}
            disabled={busy}
            onPress={alternatives}
          />
        )}
      </Card>
      {!app.demo && (
        <Card>
          <Button
            secondary
            title="Set iPhone lock-screen alarms"
            onPress={alarms}
          />
          <Text style={styles.muted}>
            {iPhoneHandoffChanged(j)
              ? "Times changed. Re-import and confirm your iPhone alarms."
              : hasIPhoneHandoff(j)
                ? "Handoff attempted — check the alarm app to confirm scheduling."
                : "Requires the separate LeaveNow Alarms app on iOS 26+. Expo Go does not provide AlarmKit."}
          </Text>
        </Card>
      )}
      <Button
        secondary
        title="Cancel this trip"
        onPress={() =>
          Alert.alert(
            "Cancel trip?",
            hasIPhoneHandoff(j)
              ? "Also cancel any imported alarms in LeaveNow Alarms. They do not sync."
              : "Your saved places and progress will be kept.",
            [
              { text: "Keep trip", style: "cancel" },
              { text: "Cancel trip", style: "destructive", onPress: finish },
            ],
          )
        }
      />
    </Screen>
  );
}
