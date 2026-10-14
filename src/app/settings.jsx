import React, { useState } from "react";
import { Text, Switch, View, Linking } from "react-native";
import { router } from "expo-router";
import { Screen, Card, Button, Row, styles, colors } from "../components/ui";
import { useApp } from "../state/AppContext";
import { profileName } from "../domain/address-planner.mjs";
export default function Settings() {
  const app = useApp(),
    t = app.session.travel;
  const [about, setAbout] = useState(false);
  return (
    <Screen>
      <Text style={{ color: "white" }}>Your places. Your pace. Your way.</Text>
      <Text style={styles.section}>SAVED PLACES</Text>
      <Card>
        <Row
          title="Home"
          subtitle={t.home.place?.label || "Add your address"}
          disabled={!!t.journey}
          onPress={() =>
            router.push({ pathname: "/place", params: { id: "home" } })
          }
        />
        {Object.entries(t.profiles).map(([id, p]) => (
          <Row
            key={id}
            title={profileName(t, id)}
            subtitle={p.place?.label || "Add an address"}
            disabled={!!t.journey}
            onPress={() => router.push({ pathname: "/place", params: { id } })}
          />
        ))}
        <Row
          title="+ Add destination"
          disabled={!!t.journey}
          onPress={() =>
            router.push({ pathname: "/place", params: { id: "new" } })
          }
        />
        {t.journey && (
          <Text style={styles.muted}>
            Finish or cancel this trip to edit saved places.
          </Text>
        )}
      </Card>
      <Text style={styles.section}>YOUR TRAVEL BUDDY</Text>
      <Card>
        <Row title="Buddy animations">
          <Switch
            accessibilityLabel="Buddy animations"
            trackColor={{ true: colors.blue }}
            value={app.session.buddy.motion}
            onValueChange={(value) =>
              app.update((s) => {
                s.buddy.motion = value;
              })
            }
          />
        </Row>
        <Row
          title="Meet your crew"
          subtitle={`${app.session.buddy.successDays.length} successful days`}
          onPress={() => router.push("/crew")}
        />

        <Button
          secondary
          disabled={!!t.journey && !app.demo}
          title="Try Demo mode"
          onPress={() => {
            if (app.startDemo()) router.replace("/");
          }}
        />
      </Card>
      <Text style={styles.section}>REMINDERS & PRIVACY</Text>
      <Card>
        <Row
          title="Preparation & privacy"
          subtitle={`${t.home.prep} min usual time · Your records & feedback`}
          onPress={() => router.push("/privacy")}
        />
        <Row
          title="iPhone alarms"
          subtitle="Open the separate LeaveNow Alarms app"
          onPress={() =>
            Linking.openURL("leavenow://open").catch(() =>
              app.setNotice(
                "Install LeaveNow Alarms to use this feature. Expo Go does not contain AlarmKit.",
              ),
            )
          }
        />
        <Text style={styles.muted}>
          Expo Go does not schedule AlarmKit alarms. Lock-screen alarms need the
          separate iPhone app and confirmation there. Changes do not sync.
        </Text>
      </Card>
      <Card>
        <Row title="About LeaveNow" onPress={() => setAbout(!about)} />
        {about && (
          <View style={{ gap: 12 }}>
            <Text style={styles.text}>
              Independent departure assistant · Queensland
            </Text>
            <Row
              title="Journey planning: Translink / TMR ↗"
              onPress={() =>
                Linking.openURL(
                  "https://translink.com.au/about-translink/open-data",
                )
              }
            />
            <Text style={styles.muted}>
              Independent student project, not an official Translink service.
              All times use Brisbane time. Searches go to Translink through the
              development transport service. Preparation records, feedback and
              recordings stay on this device. Safari data is separate.
            </Text>
          </View>
        )}
      </Card>
    </Screen>
  );
}
