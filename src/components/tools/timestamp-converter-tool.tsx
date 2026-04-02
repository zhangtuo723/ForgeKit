"use client";

import { useState } from "react";

export function TimestampConverterTool() {
  const [timestampInput, setTimestampInput] = useState("");
  const [dateInput, setDateInput] = useState("");

  const timestampResult = (() => {
    if (!timestampInput.trim()) {
      return "Enter a Unix timestamp in seconds or milliseconds.";
    }

    const raw = Number(timestampInput.trim());
    if (Number.isNaN(raw)) {
      return "Timestamp must be numeric.";
    }

    const ms = String(Math.trunc(raw)).length <= 10 ? raw * 1000 : raw;
    const date = new Date(ms);
    if (Number.isNaN(date.getTime())) {
      return "Timestamp is invalid.";
    }

    return [
      `UTC: ${date.toUTCString()}`,
      `Local: ${date.toString()}`,
      `ISO: ${date.toISOString()}`
    ].join("\n");
  })();

  const dateResult = (() => {
    if (!dateInput.trim()) {
      return "Enter a date string such as 2026-04-03 09:30:00.";
    }

    const date = new Date(dateInput);
    if (Number.isNaN(date.getTime())) {
      return "Date string is invalid.";
    }

    return [
      `Seconds: ${Math.floor(date.getTime() / 1000)}`,
      `Milliseconds: ${date.getTime()}`,
      `ISO: ${date.toISOString()}`
    ].join("\n");
  })();

  return (
    <section className="grid gap-6 xl:grid-cols-2">
      <div className="rounded-[2rem] border border-white/10 bg-slate-900/70 p-6">
        <h2 className="text-2xl font-semibold text-white">Timestamp to Date</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Drop in seconds or milliseconds from logs, DB records, or backend responses.
        </p>
        <input
          value={timestampInput}
          onChange={(event) => setTimestampInput(event.target.value)}
          placeholder="1712082600"
          className="mt-4 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/50"
        />
        <pre className="mt-4 min-h-[220px] rounded-3xl bg-slate-950 p-4 text-sm leading-6 text-slate-200">
          {timestampResult}
        </pre>
      </div>
      <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-2xl font-semibold text-white">Date to Timestamp</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Convert readable dates into Unix values for API payloads and test fixtures.
        </p>
        <input
          value={dateInput}
          onChange={(event) => setDateInput(event.target.value)}
          placeholder="2026-04-03T09:30:00+08:00"
          className="mt-4 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/50"
        />
        <pre className="mt-4 min-h-[220px] rounded-3xl bg-slate-950 p-4 text-sm leading-6 text-slate-200">
          {dateResult}
        </pre>
      </div>
    </section>
  );
}
