import React from "react";
import { Text, Switch } from "react-native";
import { router } from "expo-router";
import { Screen, Card, Row, styles, colors } from "../components/ui";
import { useApp } from "../state/AppContext";

export default function Voice() {
  const app = useApp();
  return (
    <Screen>
      <Text style={styles.title}>Your voice options</Text>
      <Text style={{ color: "white" }}>
        Choose how your buddy speaks to you.
      </Text>
      <Card>
        <Row
          title="Australian voice"
          subtitle="Spoken reminders, always with text"
        >
          <Switch
            accessibilityLabel="Australian voice"
            trackColor={{ true: colors.blue }}
            value={app.session.buddy.voice}
            onValueChange={(value) => {
              app.update((s) => {
                s.buddy.voice = value;
              });
              if (!value) app.stop();
            }}
          />
        </Row>
        <Row
          title="Test voice"
          subtitle="Hear the default buddy voice"
          onPress={() => app.say("preview", true)}
        />
        <Row
          title="Record my reminders"
          subtitle="Add a familiar voice"
          onPress={() => router.push("/recordings")}
        />
        <Text style={styles.muted}>
          Default voice: Ballad, AI-generated with Australian English direction.
          In-app voice plays while LeaveNow is active.
        </Text>
      </Card>
    </Screen>
  );
}
