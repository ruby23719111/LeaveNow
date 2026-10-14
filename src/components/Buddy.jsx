import React, { useEffect, useState } from "react";
import {
  View,
  Image,
  Text,
  Pressable,
  Animated,
  AccessibilityInfo,
} from "react-native";
import { BUDDIES } from "../domain/companion.mjs";
import { useApp } from "../state/AppContext";
import { colors, styles } from "./ui";
const sheets = {
  atlas: require("../../assets/buddies/buddy-atlas.png"),
  green_bus: require("../../assets/buddies/green-bus-buddy.png"),
  metro: require("../../assets/buddies/metro-buddy.png"),
};
export function BuddyImage({ id = "bus", emotion = "calm", size = 110 }) {
  const b = BUDDIES.find((v) => v.id === id) || BUDDIES[0],
    frame = Math.max(0, ["calm", "remind", "happy", "caring"].indexOf(emotion));
  const quad = b.sheet === "quad",
    cols = quad ? 2 : 6,
    rows = quad ? 2 : 4,
    x = quad ? frame % 2 : b.column,
    y = quad ? Math.floor(frame / 2) : frame;
  return (
    <View
      style={{ width: size, height: size, overflow: "hidden" }}
      accessibilityLabel={`${b.name} looks ${emotion}`}
      accessibilityRole="image"
    >
      <Image
        source={sheets[b.id] || sheets.atlas}
        style={{
          position: "absolute",
          width: size * cols,
          height: size * rows,
          left: -size * x,
          top: -size * y,
        }}
        resizeMode="stretch"
      />
    </View>
  );
}
export default function Buddy({ text, emotion = "calm", compact = false }) {
  const app = useApp(),
    [motion] = useState(() => new Animated.Value(0));
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (!app.speaking || !app.session.buddy.motion || reduced) {
      motion.stopAnimation();
      motion.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(motion, {
          toValue: -4,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(motion, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [app.speaking, app.session.buddy.motion, motion, reduced]);
  const b =
    BUDDIES.find((v) => v.id === app.session.buddy.selected) || BUDDIES[0];
  return (
    <View style={[styles.row, { gap: 8 }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Say hi to ${b.name}`}
        onPress={() => app.say("hello")}
      >
        <Animated.View style={{ transform: [{ translateY: motion }] }}>
          <BuddyImage id={b.id} emotion={emotion} size={compact ? 88 : 110} />
        </Animated.View>
      </Pressable>
      <View
        style={{
          flex: 1,
          padding: 12,
          backgroundColor: "white",
          borderRadius: 20,
          borderBottomLeftRadius: 5,
        }}
      >
        <Text style={[styles.eyebrow, { fontSize: 10, color: colors.blue }]}>
          {b.name.toUpperCase()}
        </Text>
        <Text
          accessibilityLiveRegion="polite"
          style={[
            styles.text,
            { fontSize: 14, fontWeight: "550", marginTop: 5 },
          ]}
        >
          {app.speech || text}
        </Text>
      </View>
    </View>
  );
}
