import React, { useCallback, useEffect, useRef, useState } from "react";
import { Text, Switch, Alert, Platform, AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import {
  useAudioRecorder,
  useAudioRecorderState,
  useAudioPlayer,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import { Screen, Card, Button, Field, Row, styles } from "../components/ui";
import { useApp } from "../state/AppContext";
import { LINES } from "../domain/companion.mjs";
const slots = {
  prepare: "Start getting ready",
  leave: "Time to head out",
  caught: "You caught it",
  missed: "You missed it",
};
export default function Recordings() {
  const app = useApp(),
    recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY),
    recordState = useAudioRecorderState(recorder),
    preview = useAudioPlayer(null);
  const [active, setActive] = useState(""),
    [draft, setDraft] = useState(null),
    [caption, setCaption] = useState(""),
    [busy, setBusy] = useState(false);
  const current = useRef(""),
    timer = useRef(null),
    live = useRef(true),
    stopping = useRef(false);
  const stopRecording = useCallback(async () => {
    if (!current.current || stopping.current) return;
    stopping.current = true;
    clearTimeout(timer.current);
    const id = current.current;
    try {
      await recorder.stop();
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });
      if (live.current) {
        setActive("");
        setDraft({ id, uri: recorder.uri });
        setCaption(LINES[id === "prepare" ? "prepare_any" : id]);
      }
    } catch {
      if (live.current)
        app.setNotice("Could not finish the recording. Please try again.");
    } finally {
      current.current = "";
      stopping.current = false;
    }
  }, [recorder, app]);
  useFocusEffect(
    useCallback(() => {
      live.current = true;
      return () => {
        live.current = false;
        clearTimeout(timer.current);
        preview.pause();
        if (current.current) {
          current.current = "";
          void recorder.stop().catch(() => {});
        }
        void setAudioModeAsync({ allowsRecording: false });
      };
    }, [recorder, preview]),
  );
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        preview.pause();
        if (current.current) void stopRecording();
      }
    });
    return () => sub.remove();
  }, [preview, stopRecording]);
  async function record(id) {
    if (app.demo) {
      app.setNotice(
        "Exit Demo to record on your own profile. Demo does not save microphone clips.",
      );
      return;
    }
    setBusy(true);
    try {
      app.stop();
      preview.pause();
      if (Platform.OS === "web")
        throw Error("Use Expo Go on your phone to record and save reminders.");
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted)
        throw Error(
          "Microphone access was not allowed. You can keep using the default voice.",
        );
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        shouldPlayInBackground: false,
      });
      await recorder.prepareToRecordAsync();
      setDraft(null);
      current.current = id;
      setActive(id);
      recorder.record();
      timer.current = setTimeout(() => void stopRecording(), 15000);
    } catch (e) {
      app.setNotice(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function save() {
    setBusy(true);
    try {
      if (!draft?.uri) throw Error("No recording to save.");
      if (!caption.trim())
        throw Error(
          "Add the words you recorded so the reminder also has a caption.",
        );
      const folder = FileSystem.documentDirectory + "reminders/";
      await FileSystem.makeDirectoryAsync(folder, { intermediates: true });
      const uri = folder + draft.id + "-" + Date.now() + ".m4a";
      await FileSystem.copyAsync({ from: draft.uri, to: uri });
      const previous = app.session.recordings[draft.id]?.uri;
      app.update((s) => {
        s.recordings[draft.id] = { uri, caption: caption.trim() };
        s.useRecordings = true;
      });
      if (previous)
        await FileSystem.deleteAsync(previous, { idempotent: true });
      setDraft(null);
      app.setNotice("Recording saved on this device.");
    } catch (e) {
      app.setNotice(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen>
      <Card>
        <Text style={styles.heading}>A familiar voice, in your own words.</Text>
        <Text style={styles.muted}>
          Record four short messages — no voice cloning. Aim for 3–8 seconds, up
          to 15. Use your own voice or ask the speaker’s permission. Recordings
          stay on this device and do not change iPhone alarms.
        </Text>
        <Row title="Use my recordings">
          <Switch
            value={app.session.useRecordings}
            onValueChange={(value) =>
              app.update((s) => {
                s.useRecordings = value;
              })
            }
          />
        </Row>
        {app.demo && (
          <Text style={styles.muted}>
            Demo recordings are not saved to your real profile.
          </Text>
        )}
      </Card>
      {Object.entries(slots).map(([id, title]) => (
        <Card key={id}>
          <Text style={styles.heading}>{title}</Text>
          <Text style={styles.muted}>
            {app.session.recordings[id]?.caption ||
              LINES[id === "prepare" ? "prepare_any" : id]}
          </Text>
          {active === id ? (
            <>
              <Text style={styles.text}>
                Recording · {Math.round(recordState.durationMillis / 1000)} / 15
                sec
              </Text>
              <Button title="Stop recording" onPress={stopRecording} />
            </>
          ) : (
            <Button
              secondary
              disabled={busy || !!active}
              title={app.session.recordings[id] ? "Record again" : "Record"}
              onPress={() => record(id)}
            />
          )}
          {draft?.id === id && (
            <>
              <Field
                label="Words in this recording"
                value={caption}
                onChangeText={setCaption}
                multiline
              />
              <Button
                secondary
                title="Listen before saving"
                onPress={() => {
                  preview.replace({ uri: draft.uri });
                  preview.play();
                }}
              />
              <Button title="Save recording" disabled={busy} onPress={save} />
              <Button
                quiet
                title="Discard"
                onPress={() => {
                  preview.pause();
                  setDraft(null);
                }}
              />
            </>
          )}
          {app.session.recordings[id] && !draft && (
            <>
              <Button
                quiet
                title="Listen"
                onPress={() => {
                  preview.replace({ uri: app.session.recordings[id].uri });
                  preview.play();
                }}
              />
              <Button
                quiet
                title="Delete recording"
                onPress={() =>
                  Alert.alert(
                    "Delete this recording?",
                    "The default buddy voice will be used instead.",
                    [
                      { text: "Keep", style: "cancel" },
                      {
                        text: "Delete",
                        style: "destructive",
                        onPress: async () => {
                          preview.pause();
                          const uri = app.session.recordings[id].uri;
                          app.update((s) => {
                            delete s.recordings[id];
                          });
                          await FileSystem.deleteAsync(uri, {
                            idempotent: true,
                          }).catch(() => {});
                        },
                      },
                    ],
                  )
                }
              />
            </>
          )}
        </Card>
      ))}
    </Screen>
  );
}
