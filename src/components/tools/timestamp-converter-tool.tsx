"use client";

import { useState } from "react";

import { CodeEditor } from "@/components/code-editor";
import { type Locale } from "@/lib/i18n";

export function TimestampConverterTool({ locale }: { locale: Locale }) {
  const [timestampInput, setTimestampInput] = useState("");
  const [dateInput, setDateInput] = useState("");
  const text =
    locale === "zh"
      ? {
          leftTitle: "时间戳转日期",
          leftDesc: "输入秒级或毫秒级时间戳，适合处理日志、数据库和后端返回数据。",
          leftPlaceholder: "1712082600",
          emptyTimestamp: "输入 Unix 时间戳（秒或毫秒）。",
          invalidNumber: "时间戳必须是数字。",
          invalidTimestamp: "时间戳无效。",
          utc: "UTC",
          local: "本地",
          iso: "ISO",
          rightTitle: "日期转时间戳",
          rightDesc: "把可读日期转换成 Unix 时间，适合构造接口请求和测试数据。",
          rightPlaceholder: "2026-04-03T09:30:00+08:00",
          emptyDate: "输入一个日期字符串，例如 2026-04-03 09:30:00。",
          invalidDate: "日期字符串无效。",
          seconds: "秒",
          milliseconds: "毫秒"
        }
      : {
          leftTitle: "Timestamp to Date",
          leftDesc: "Drop in seconds or milliseconds from logs, DB records, or backend responses.",
          leftPlaceholder: "1712082600",
          emptyTimestamp: "Enter a Unix timestamp in seconds or milliseconds.",
          invalidNumber: "Timestamp must be numeric.",
          invalidTimestamp: "Timestamp is invalid.",
          utc: "UTC",
          local: "Local",
          iso: "ISO",
          rightTitle: "Date to Timestamp",
          rightDesc: "Convert readable dates into Unix values for API payloads and test fixtures.",
          rightPlaceholder: "2026-04-03T09:30:00+08:00",
          emptyDate: "Enter a date string such as 2026-04-03 09:30:00.",
          invalidDate: "Date string is invalid.",
          seconds: "Seconds",
          milliseconds: "Milliseconds"
        };

  const timestampResult = (() => {
    if (!timestampInput.trim()) {
      return text.emptyTimestamp;
    }

    const raw = Number(timestampInput.trim());
    if (Number.isNaN(raw)) {
      return text.invalidNumber;
    }

    const ms = String(Math.trunc(raw)).length <= 10 ? raw * 1000 : raw;
    const date = new Date(ms);
    if (Number.isNaN(date.getTime())) {
      return text.invalidTimestamp;
    }

    return [
      `${text.utc}: ${date.toUTCString()}`,
      `${text.local}: ${date.toString()}`,
      `${text.iso}: ${date.toISOString()}`
    ].join("\n");
  })();

  const dateResult = (() => {
    if (!dateInput.trim()) {
      return text.emptyDate;
    }

    const date = new Date(dateInput);
    if (Number.isNaN(date.getTime())) {
      return text.invalidDate;
    }

    return [
      `${text.seconds}: ${Math.floor(date.getTime() / 1000)}`,
      `${text.milliseconds}: ${date.getTime()}`,
      `${text.iso}: ${date.toISOString()}`
    ].join("\n");
  })();

  return (
    <section className="grid gap-6 xl:grid-cols-2">
      <div className="rounded-[2rem] border border-white/10 bg-slate-900/70 p-6">
        <h2 className="text-2xl font-semibold text-white">{text.leftTitle}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">{text.leftDesc}</p>
        <input
          value={timestampInput}
          onChange={(event) => setTimestampInput(event.target.value)}
          placeholder={text.leftPlaceholder}
          className="mt-4 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/50"
        />
        <div className="mt-4">
          <CodeEditor value={timestampResult} readOnly minHeight="220px" />
        </div>
      </div>
      <div className="rounded-[2rem] border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-2xl font-semibold text-white">{text.rightTitle}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">{text.rightDesc}</p>
        <input
          value={dateInput}
          onChange={(event) => setDateInput(event.target.value)}
          placeholder={text.rightPlaceholder}
          className="mt-4 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300/50"
        />
        <div className="mt-4">
          <CodeEditor value={dateResult} readOnly minHeight="220px" />
        </div>
      </div>
    </section>
  );
}
