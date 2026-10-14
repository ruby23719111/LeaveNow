import React, { useState } from "react";
import { Modal, View, Text, Platform } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Button, styles } from "./ui";
export default function DateTimeField({ date, time, onChange, mode }) {
  const [open, setOpen] = useState(false),
    [draft, setDraft] = useState(new Date());
  const value = new Date(`${date}T${time}:00+10:00`);
  const apply = (d) => {
    const local = new Date(d.getTime() + 36000000).toISOString();
    onChange(mode === "date" ? local.slice(0, 10) : local.slice(11, 16));
  };
  return (
    <>
      <Button
        secondary
        title={mode === "date" ? date : time}
        onPress={() => {
          setDraft(value);
          setOpen(true);
        }}
        accessibilityLabel={
          mode === "date" ? "Choose travel date" : "Choose arrival time"
        }
      />
      {open &&
        (Platform.OS === "ios" ? (
          <Modal
            transparent
            animationType="slide"
            onRequestClose={() => setOpen(false)}
          >
            <View
              style={{
                flex: 1,
                justifyContent: "flex-end",
                backgroundColor: "#0006",
              }}
            >
              <View style={[styles.card, { paddingBottom: 32 }]}>
                <Text style={styles.heading}>
                  {mode === "date" ? "Travel date" : "Arrive by"}
                </Text>
                <DateTimePicker
                  value={draft}
                  mode={mode}
                  display="spinner"
                  locale="en_AU"
                  timeZoneName="Australia/Brisbane"
                  is24Hour
                  onChange={(_, d) => d && setDraft(d)}
                />
                <Button
                  title="Done"
                  onPress={() => {
                    apply(draft);
                    setOpen(false);
                  }}
                />
                <Button
                  secondary
                  title="Cancel"
                  onPress={() => setOpen(false)}
                />
              </View>
            </View>
          </Modal>
        ) : (
          <DateTimePicker
            value={value}
            mode={mode}
            timeZoneName="Australia/Brisbane"
            is24Hour
            onChange={(event, d) => {
              setOpen(false);
              if (event.type === "set" && d) apply(d);
            }}
          />
        ))}
    </>
  );
}
