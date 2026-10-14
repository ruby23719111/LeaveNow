import React, { useState } from "react";
import { Text, Switch, Alert } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Screen, Card, Button, Row, Field, styles } from "../components/ui";
import { useApp } from "../state/AppContext";
import { api } from "../services/api";
import {
  savePlace,
  removePlace,
  profileName,
} from "../domain/address-planner.mjs";
export default function Place() {
  const { id = "new" } = useLocalSearchParams(),
    app = useApp(),
    t = app.session.travel;
  const old =
    id === "home"
      ? t.home.place
      : id === "once"
        ? t.oneOff?.place
        : t.profiles[id]?.place;
  const [query, setQuery] = useState(old?.label || ""),
    [selected, setSelected] = useState(old),
    [results, setResults] = useState([]),
    [name, setName] = useState(id === "new" ? "" : profileName(t, id)),
    [regular, setRegular] = useState(id !== "once"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const builtin = ["home", "uni", "work"].includes(id);
  async function search() {
    setBusy(true);
    setError("");
    setSelected(null);
    try {
      const data = await api("/api/locations?q=" + encodeURIComponent(query));
      setResults(data.locations);
      if (!data.locations.length)
        setError("No places found. Try including a suburb.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function save() {
    try {
      if (t.journey) throw Error("Finish or cancel your current trip first.");
      if (!selected || selected.label !== query)
        throw Error("Search and select a matching address first.");
      app.update((s) => {
        if (id === "home") s.travel.home.place = selected;
        else if (id === "uni" || id === "work")
          s.travel.profiles[id].place = selected;
        else if (!regular) {
          s.travel.oneOff = {
            name: name || "This trip",
            place: selected,
            arriveBy: "09:00",
          };
          s.travel.selected = "once";
        } else {
          const key = savePlace(s.travel, {
            id: id === "new" ? undefined : id,
            name,
            place: selected,
          });
          s.travel.selected = key;
        }
        s.travel.preparationDraft = null;
      });
      router.back();
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <Screen>
      <Card>
        <Text style={styles.heading}>
          {id === "home"
            ? "Start from Home"
            : id === "new"
              ? "New destination"
              : `Edit ${profileName(t, id)}`}
        </Text>
        <Field
          label="Address or place"
          value={query}
          onChangeText={(value) => {
            setQuery(value);
            setSelected(null);
          }}
          autoCapitalize="words"
          onSubmitEditing={search}
        />
        <Button
          secondary
          title={busy ? "Searching…" : "Search Translink"}
          disabled={busy}
          onPress={search}
        />
        {results.map((place) => (
          <Row
            key={place.id}
            title={place.label}
            onPress={() => {
              setSelected(place);
              setQuery(place.label);
              setResults([]);
            }}
          />
        ))}
        {selected && (
          <Text style={styles.muted}>Selected: {selected.label}</Text>
        )}
        {!builtin && (
          <>
            <Field
              label="Place name"
              value={name}
              onChangeText={setName}
              maxLength={32}
            />
            {["new", "once"].includes(id) && (
              <Row title="Save as a regular place">
                <Switch value={regular} onValueChange={setRegular} />
              </Row>
            )}
          </>
        )}
        <Text style={styles.muted}>
          Address searches go to Translink. Your saved places stay on this
          device.
        </Text>
        {error ? <Text style={{ color: "#AC282D" }}>{error}</Text> : null}
        <Button
          title="Save place"
          disabled={busy || !!t.journey}
          onPress={save}
        />
        {!builtin && !["new", "once"].includes(id) && (
          <Button
            quiet
            title="Remove saved place"
            onPress={() =>
              Alert.alert("Remove saved place?", name, [
                { text: "Keep", style: "cancel" },
                {
                  text: "Remove",
                  style: "destructive",
                  onPress: () => {
                    app.update((s) => removePlace(s.travel, id));
                    router.back();
                  },
                },
              ])
            }
          />
        )}
      </Card>
    </Screen>
  );
}
