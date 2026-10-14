import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  useWindowDimensions,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useApp } from "../state/AppContext";
import { Screen, Card, Button, styles, colors } from "../components/ui";
import Buddy from "../components/Buddy";
import DateTimeField from "../components/DateTimeField";
import { profileName } from "../domain/address-planner.mjs";
import { dateInBrisbane } from "../domain/live-planner.mjs";
export default function Home() {
  const app = useApp(),
    { session, update } = app,
    t = session.travel;
  const profile = t.selected === "once" ? t.oneOff : t.profiles[t.selected];
  const [date, setDate] = useState(() => dateInBrisbane(Date.now() + 86400000));
  const { height, width } = useWindowDimensions();
  const small = height < 700;
  function prepare() {
    if (t.journey) {
      router.push("/trip");
      return;
    }
    if (!t.home.place) {
      router.push({ pathname: "/place", params: { id: "home" } });
      return;
    }
    if (!profile.place) {
      router.push({ pathname: "/place", params: { id: t.selected } });
      return;
    }
    update((s) => {
      const p = s.travel;
      const draft = p.preparationDraft;
      const context = {
        profileId: p.selected,
        originId: p.home.place.id,
        destinationId: profile.place.id,
        date,
        arriveBy: profile.arriveBy,
      };
      p.preparationDraft =
        draft && Object.entries(context).every(([k, v]) => draft[k] === v)
          ? { ...draft, visible: true }
          : {
              ...context,
              minutes: String(p.home.prep),
              activities: [],
              visible: true,
            };
    });
    router.push("/preparation");
  }
  if (!app.loaded)
    return (
      <Screen home>
        <ActivityIndicator color="white" />
      </Screen>
    );
  const places =
    t.selected === "once"
      ? [["once", t.oneOff], ...Object.entries(t.profiles)]
      : Object.entries(t.profiles);
  return (
    <Screen home>
      <View
        style={[
          styles.row,
          { justifyContent: "space-between", flexWrap: "wrap" },
        ]}
      >
        <View style={[styles.row, { gap: 8 }]}>
          <View
            style={{
              backgroundColor: colors.yellow,
              borderRadius: 10,
              padding: 7,
            }}
          >
            <Text
              style={{ fontSize: 21, fontWeight: "700", color: colors.ink }}
            >
              L↗
            </Text>
          </View>
          <Text
            style={{
              fontSize: width < 375 ? 19 : 23,
              color: "white",
              fontWeight: "750",
            }}
          >
            LeaveNow
          </Text>
        </View>
        <View style={[styles.row, { gap: 4, marginLeft: "auto" }]}>
          {[
            {
              label: "Crew",
              icon: "people-outline",
              route: "/crew",
              hint: "View crew progress and change your buddy",
            },
            {
              label: "Voice",
              icon: app.session.buddy.voice
                ? "volume-high-outline"
                : "volume-mute-outline",
              route: "/voice",
              hint: `Voice is ${app.session.buddy.voice ? "on" : "off"}. Open voice options`,
            },
            {
              label: "Settings",
              icon: "options-outline",
              route: "/settings",
              hint: "Open settings",
            },
          ].map(({ label, icon, route, hint }) => (
            <Pressable
              key={label}
              accessibilityRole="button"
              accessibilityLabel={label === "Crew" ? "Crew Buddy" : label}
              accessibilityHint={hint}
              onPress={() => router.push(route)}
              style={({ pressed }) => ({
                minWidth: 44,
                minHeight: 48,
                paddingVertical: 4,
                paddingHorizontal: 3,
                alignItems: "center",
                justifyContent: "center",
                gap: 3,
                borderRadius: 10,
                backgroundColor: pressed ? "#FFFFFF22" : "transparent",
              })}
            >
              <Ionicons name={icon} size={22} color="white" />
              <Text style={{ color: "white", fontSize: 10, fontWeight: "600" }}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={{ gap: 5 }}>
        <Text style={[styles.eyebrow, { color: "#DCEAFF" }]}>FROM HOME</Text>
        <Text style={[styles.title, small && { fontSize: 27 }]}>
          Where to today?
        </Text>
      </View>
      <Buddy
        compact={small}
        text="You get ready. I’ll keep an eye on the time."
      />
      {t.journey ? (
        <Card>
          <Text style={styles.heading}>Your trip is in progress</Text>
          <Button
            title="Back to my trip"
            onPress={() =>
              router.push(
                t.journey.companionOutcome
                  ? "/result"
                  : t.journey.departedAt
                    ? "/feedback"
                    : "/trip",
              )
            }
          />
        </Card>
      ) : (
        <>
          <View style={[styles.row, { gap: 9 }]}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ flex: 1 }}
              contentContainerStyle={{ gap: 10, paddingVertical: 3 }}
            >
              {places.map(([id, p]) => (
                <Pressable
                  key={id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: id === t.selected }}
                  onPress={() =>
                    update((s) => {
                      s.travel.selected = id;
                    })
                  }
                  style={{
                    backgroundColor: "white",
                    width: small ? 106 : 120,
                    minHeight: small ? 98 : 108,
                    padding: 12,
                    borderRadius: 20,
                    borderWidth: 3,
                    borderColor: id === t.selected ? colors.yellow : "white",
                    gap: 6,
                  }}
                >
                  <Ionicons
                    name={
                      id === "uni"
                        ? "school-outline"
                        : id === "work"
                          ? "briefcase-outline"
                          : "location-outline"
                    }
                    size={24}
                    color={colors.blue}
                  />
                  <Text
                    style={[styles.text, { fontSize: 17, fontWeight: "700" }]}
                  >
                    {id === "once" ? "This trip" : profileName(t, id)}
                  </Text>
                  <Text style={styles.muted}>
                    {p.place ? "From Home" : "Set up once"}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add destination"
              onPress={() =>
                router.push({ pathname: "/place", params: { id: "new" } })
              }
              style={[styles.button, { width: 48, minHeight: 72 }]}
            >
              <Text style={{ fontSize: 27 }}>+</Text>
              <Text>Add</Text>
            </Pressable>
          </View>
          <Card style={{ padding: 16 }}>
            <View style={[styles.row, { alignItems: "stretch" }]}>
              <View style={{ flex: 0.8, gap: 6 }}>
                <Text style={styles.text}>Arrive by</Text>
                <DateTimeField
                  date={date}
                  time={profile.arriveBy}
                  mode="time"
                  onChange={(value) =>
                    update((s) => {
                      (s.travel.selected === "once"
                        ? s.travel.oneOff
                        : s.travel.profiles[s.travel.selected]
                      ).arriveBy = value;
                    })
                  }
                />
              </View>
              <View style={{ flex: 1.2, gap: 6 }}>
                <Text style={styles.text}>On</Text>
                <DateTimeField
                  date={date}
                  time={profile.arriveBy}
                  mode="date"
                  onChange={setDate}
                />
              </View>
            </View>
            <Button
              title={
                !t.home.place
                  ? "Set up Home"
                  : !profile.place
                    ? `Set up ${profileName(t, t.selected)}`
                    : "Find routes"
              }
              onPress={prepare}
            />
          </Card>
        </>
      )}
    </Screen>
  );
}
