import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  useAudioPlayer,
  useAudioPlayerStatus,
  setAudioModeAsync,
} from "expo-audio";
import { emptySession, restoreSession, makeDemo } from "./session.mjs";
import { advanceEarlierPlan } from "../domain/address-planner.mjs";
import { nextCue } from "../domain/home-planner.mjs";
import { journeyRequest } from "../domain/preparation.mjs";
import { api } from "../services/api";
import { LINES } from "../domain/companion.mjs";
import { audioClips } from "../services/assets";
const KEY = "leavenow.native.v1";
const Context = createContext(null);
export function AppProvider({ children }) {
  const [session, setSession] = useState(emptySession),
    [loaded, setLoaded] = useState(false),
    [demo, setDemo] = useState(false),
    [notice, setNotice] = useState(""),
    [speech, setSpeech] = useState(""),
    [routes, setRoutes] = useState(null);
  const current = useRef(session),
    real = useRef(session),
    demoRef = useRef(false),
    saveQueue = useRef(Promise.resolve()),
    appActive = useRef(true),
    voiceSequence = useRef(0),
    activeVoice = useRef({ priority: 0, until: 0 });
  const player = useAudioPlayer(null),
    audioStatus = useAudioPlayerStatus(player);
  const commit = useCallback((next) => {
    current.current = next;
    setSession(next);
    if (!demoRef.current) {
      real.current = next;
      saveQueue.current = saveQueue.current
        .then(() => AsyncStorage.setItem(KEY, JSON.stringify(next)))
        .catch(() =>
          setNotice(
            "Could not save on this device. Keep the app open and try again.",
          ),
        );
    }
  }, []);
  const update = useCallback(
    (fn) => {
      const next = structuredClone(current.current);
      fn(next);
      commit(next);
    },
    [commit],
  );
  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(KEY)
      .then((value) => {
        if (live) {
          const next = restoreSession(value ? JSON.parse(value) : null);
          current.current = next;
          real.current = next;
          setSession(next);
        }
      })
      .catch(() => setNotice("Saved data could not be loaded."))
      .finally(() => live && setLoaded(true));
    return () => {
      live = false;
    };
  }, []);
  const stop = useCallback(() => {
    voiceSequence.current++;
    activeVoice.current = { priority: 0, until: 0 };
    player.pause();
    setSpeech("");
  }, [player]);
  const say = useCallback(
    async (id, force = false) => {
      if (!appActive.current || (!current.current.buddy.voice && !force))
        return false;
      const priority = id === "leave" ? 3 : id.startsWith("prepare") ? 2 : 1;
      if (
        activeVoice.current.until > Date.now() &&
        activeVoice.current.priority > priority
      )
        return false;
      const sequence = ++voiceSequence.current;
      activeVoice.current = { priority, until: Date.now() + 20000 };
      const mapped = {
        prepare: "prepare",
        prepare_any: "prepare",
        leave: "leave",
        caught: "caught",
        missed: "missed",
      }[id];
      const recording =
        current.current.useRecordings && mapped
          ? current.current.recordings[mapped]
          : null;
      try {
        player.pause();
        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: false,
          shouldPlayInBackground: false,
        });
        if (sequence !== voiceSequence.current || !appActive.current)
          return false;
        player.replace(
          recording?.uri
            ? { uri: recording.uri }
            : audioClips[id] || audioClips.hello,
        );
        setSpeech(recording?.caption || LINES[id] || LINES.hello);
        player.play();
        return true;
      } catch {
        activeVoice.current = { priority: 0, until: 0 };
        setNotice(
          "Voice could not play. The reminder is still shown on screen.",
        );
        setSpeech("");
        return false;
      }
    },
    [player],
  );
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      appActive.current = state === "active";
      if (state !== "active") stop();
    });
    return () => sub.remove();
  }, [stop]);
  useEffect(() => {
    const subscription = player.addListener(
      "playbackStatusUpdate",
      (status) => {
        if (status.didJustFinish) {
          activeVoice.current = { priority: 0, until: 0 };
          setSpeech("");
        }
      },
    );
    return () => subscription.remove();
  }, [player]);
  useEffect(() => {
    const timer = setInterval(async () => {
      const j = current.current.travel.journey;
      if (
        demoRef.current ||
        !loaded ||
        !appActive.current ||
        !j?.armed ||
        j.departedAt
      )
        return;
      if (
        j.service.cancelled ||
        j.service.skipped ||
        j.service.scheduledDeparture * 1000 < Date.now()
      )
        return;
      const cue = nextCue(j);
      if (cue && (await say(cue.kind === "leave" ? "leave" : "prepare_any")))
        update((s) => {
          if (s.travel.journey?.id === j.id) {
            s.travel.journey.cues ||= [];
            s.travel.journey.cues.push(cue.key);
          }
        });
    }, 1000);
    return () => clearInterval(timer);
  }, [loaded, say, update]);
  useEffect(() => {
    let busy = false,
      disposed = false;
    const refresh = async () => {
      const j = current.current.travel.journey;
      if (
        busy ||
        demoRef.current ||
        !appActive.current ||
        !j?.armed ||
        j.departedAt
      )
        return;
      busy = true;
      try {
        const data = await api(
          "/api/plan",
          journeyRequest(j.settings, j.searchQuery || {}),
        );
        if (
          disposed ||
          demoRef.current ||
          current.current.travel.journey?.id !== j.id ||
          current.current.travel.journey.service.id !== j.service.id ||
          current.current.travel.journey.departedAt
        )
          return;
        const service = data.services.find((s) => s.id === j.service.id);
        let earlier = false;
        update((s) => {
          const trip = s.travel.journey;
          trip.services = data.services;
          trip.feed = service ? data.feed : { status: "unavailable" };
          if (service) {
            trip.service = service;
            earlier = advanceEarlierPlan(trip);
          }
        });
        if (!service)
          setNotice(
            "Could not confirm this journey. Saved reminder times are kept. Check Translink before leaving.",
          );
        else if (earlier) {
          setNotice(
            "Your journey is earlier. Review your new leave time and update any iPhone alarms.",
          );
          void say("check");
        }
      } catch {
        if (
          !disposed &&
          current.current.travel.journey?.id === j.id &&
          !demoRef.current
        ) {
          update((s) => {
            s.travel.journey.feed = { status: "unavailable" };
          });
          setNotice(
            "Transport update unavailable. Keep your saved leave time and check Translink.",
          );
        }
      } finally {
        busy = false;
      }
    };
    const timer = setInterval(refresh, 60000);
    return () => {
      disposed = true;
      clearInterval(timer);
    };
  }, [say, update]);
  const startDemo = (seed = 0) => {
    if (real.current.travel.journey) {
      setNotice("Finish or cancel your real trip first.");
      return false;
    }
    stop();
    const value = makeDemo(seed);
    demoRef.current = true;
    setDemo(true);
    current.current = value;
    setSession(value);
    setRoutes(null);
    setNotice("");
    return true;
  };
  const exitDemo = () => {
    stop();
    demoRef.current = false;
    setDemo(false);
    current.current = real.current;
    setSession(real.current);
    setRoutes(null);
    setNotice("");
  };
  return (
    <Context.Provider
      value={{
        session,
        loaded,
        demo,
        update,
        notice,
        setNotice,
        speech,
        speaking: audioStatus.playing,
        say,
        stop,
        startDemo,
        exitDemo,
        routes,
        setRoutes,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useApp = () => useContext(Context);
