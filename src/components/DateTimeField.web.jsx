import React from "react";
export default function DateTimeField({ date, time, onChange, mode }) {
  return (
    <input
      aria-label={
        mode === "date" ? "Choose travel date" : "Choose arrival time"
      }
      type={mode}
      value={mode === "date" ? date : time}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: "100%",
        boxSizing: "border-box",
        height: 50,
        font: "inherit",
        fontSize: 16,
        padding: 10,
        border: "1px solid #D5E1EC",
        borderRadius: 12,
        color: "#152B40",
        background: "#F7FAFD",
      }}
    />
  );
}
