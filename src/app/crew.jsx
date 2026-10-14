import React from "react";
import { Text, View, Pressable, Linking } from "react-native";
import { Screen, Card, Button, styles, colors } from "../components/ui";
import { BuddyImage } from "../components/Buddy";
import { useApp } from "../state/AppContext";
import { BUDDIES, selectBuddy, demoDays } from "../domain/companion.mjs";
export default function Crew() {
  const app = useApp(),
    count = app.session.buddy.successDays.length;
  return (
    <Screen>
      <Text style={styles.title}>{count} successful days</Text>
      <Text style={{ color: "white" }}>No streaks. No lost progress.</Text>
      {app.demo && (
        <Card>
          <Text style={styles.muted}>
            Demo progress · Does not change your real collection
          </Text>
          <View style={styles.chips}>
            {[0, 1, 3, 7, 21, 66].map((n) => (
              <Button
                key={n}
                secondary
                title={String(n)}
                onPress={() =>
                  app.update((s) => {
                    s.buddy.successDays = demoDays(n);
                    s.buddy.selected = "bus";
                  })
                }
              />
            ))}
          </View>
        </Card>
      )}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {BUDDIES.map((b) => (
          <Pressable
            key={b.id}
            disabled={count < b.days}
            accessibilityRole="button"
            accessibilityLabel={`${b.name}, ${count < b.days ? `unlock at ${b.days} days` : "choose buddy"}`}
            onPress={() => {
              app.update((s) => selectBuddy(s.buddy, b.id));
              void app.say("hello");
            }}
            style={{
              width: "47%",
              alignItems: "center",
              padding: 12,
              borderRadius: 22,
              backgroundColor: "white",
              borderWidth: 3,
              borderColor:
                app.session.buddy.selected === b.id ? colors.yellow : "white",
              opacity: count < b.days ? 0.65 : 1,
            }}
          >
            <BuddyImage id={b.id} size={115} />
            <Text style={[styles.text, { fontWeight: "700" }]}>{b.name}</Text>
            <Text style={styles.muted}>{b.rarity}</Text>
            <Text style={styles.muted}>
              {count < b.days
                ? `Unlock at ${b.days} days`
                : app.session.buddy.selected === b.id
                  ? "Your buddy ✓"
                  : "Choose buddy"}
            </Text>
          </Pressable>
        ))}
      </View>
      <Card>
        <Text style={styles.muted}>
          Student concept, not an official collaboration. Every buddy has the
          same abilities. CityDog designs reference Brisbane’s Bluey and Bingo
          ferries; commercial use of these characters needs a rights review.
        </Text>
        <Button
          quiet
          title="Meet the real CityDogs ↗"
          onPress={() =>
            Linking.openURL(
              "https://www.bluey.tv/blog/brisbane-welcomes-citydogs/",
            )
          }
        />
      </Card>
    </Screen>
  );
}
